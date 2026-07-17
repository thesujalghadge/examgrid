import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { solutionMetadataSchema } from "@/lib/solutions/solution-schema";
import { mapQuestionsToSyllabus } from "@/lib/syllabus/mapper";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "cbt-assets";
const MODEL_NAME = "gemini-3.1-flash-lite"; // Configured in one location only
const PROMPT_VERSION = "v3.0-sequential-rate-limited";

const MAX_ATTEMPTS = 5;

// Result states
type WorkerResultStatus = "NO_JOB" | "COMPLETED" | "FAILED_RETRYABLE" | "FAILED_PERMANENT" | "WAITING_DAILY_BUDGET";

interface WorkerResult {
  status: WorkerResultStatus;
  reason?: string;
  durationMs?: number;
}

function is429(err: any): boolean {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return msg.includes("429") || msg.includes("resource_exhausted") || msg.includes("rate limit") || msg.includes("quota exceeded") || msg.includes("too many requests");
}

function log(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }));
}

async function updateQueueState(
  id: string,
  status: string,
  stage: string | null = null,
  error: string | null = null,
  attempts: number | null = null,
  nextRetryAt: string | null = null,
) {
  const payload: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (stage !== null) payload.failure_stage = stage;
  if (error !== null) payload.last_error = error;
  if (status === "PROCESSING") payload.processing_started_at = new Date().toISOString();
  if (attempts !== null) payload.attempts = attempts;
  if (nextRetryAt !== null) payload.next_retry_at = nextRetryAt;
  await supabase.from("solution_generation_queue").update(payload).eq("id", id);
}

async function refreshSolutionStatus(examQuestionId: string, instituteId: string) {
  try {
    const { data: eq } = await supabase.from("exam_questions").select("exam_id").eq("id", examQuestionId).maybeSingle();
    if (!eq?.exam_id) return;
    const { data: examRow } = await supabase.from("exams").select("id").eq("id", eq.exam_id).maybeSingle();
    if (!examRow) return;
    await supabase.rpc("refresh_exam_solution_status", { p_exam_id: examRow.id, p_institute_id: instituteId });

    // --- SYLLABUS MAPPING AUTO-TRIGGER ---
    // STEP 2: Check if all questions are finished generating (terminal queue status)
    const examId = examRow.id;
    const { data: questions } = await supabase.from("exam_questions").select("id").eq("exam_id", examId);
    if (!questions || questions.length === 0) return;
    
    const questionIds = questions.map(q => q.id);
    const { data: queueRows } = await supabase.from("solution_generation_queue")
      .select("status")
      .in("question_id", questionIds);

    if (!queueRows || queueRows.length === 0) return;

    const isAllTerminal = queueRows.every(r => r.status === "COMPLETED" || r.status === "FAILED");
    if (!isAllTerminal) return;

    // STEP 3: If all terminal, check if mapping already exists (STEP 4 Idempotent)
    const { data: batches } = await supabase.from("exam_schedule_batches")
      .select("batch_id, exam_schedules!inner(exam_id)")
      .eq("exam_schedules.exam_id", examId);
      
    if (!batches || batches.length === 0) return;

    const uniqueBatchIds = [...new Set(batches.map(b => b.batch_id))];

    for (const batchId of uniqueBatchIds) {
      const { count: existingMappings } = await supabase.from("question_syllabus_mappings")
        .select("*", { count: "exact", head: true })
        .in("question_id", questionIds)
        .eq("batch_id", batchId);

      if (existingMappings && existingMappings > 0) continue; // Already mapped!

      // Trigger mapper non-blocking
      log("TRIGGERING_AUTO_MAPPER", { examId, batchId });
      mapQuestionsToSyllabus(instituteId, batchId).catch(err => log("MAPPER_TRIGGER_ERROR", { error: String(err) }));
    }

  } catch (err) {
    log("REFRESH_STATUS_ERROR", { error: String(err) });
  }
}

export async function runGeminiWorker(workerId: string = "unknown"): Promise<WorkerResult> {
  const { data: leasedJobs, error: queueError } = await supabase.rpc("lease_and_charge_job_v4");

  if (queueError) {
    log("QUEUE_LEASE_ERROR", { error: queueError.message });
    return { status: "FAILED_RETRYABLE", reason: "Queue lease error" };
  }

  if (!leasedJobs || leasedJobs.length === 0) {
    return { status: "NO_JOB" };
  }

  const job = leasedJobs[0] as any;

  if (job.status === 'WAITING_DAILY_BUDGET') {
    return { status: "WAITING_DAILY_BUDGET", reason: 'Daily budget exhausted' };
  }

  const examQuestionId = job.question_id;
  const currentAttempts = (job.attempts ?? 0) + 1;
  const startTime = Date.now();

  try {
    const { data: existingActiveSolution } = await supabase.from("question_solutions").select("id").eq("question_id", examQuestionId).eq("is_active", true).maybeSingle();
    if (existingActiveSolution) {
      await updateQueueState(job.id, "COMPLETED");
      return { status: "COMPLETED", reason: "Active solution already exists" };
    }

    const { getInstituteGeminiKey } = await import("@/lib/institute/get-institute-api-key");
    const apiKey = await getInstituteGeminiKey(job.institute_id);
    if (!apiKey) throw new Error("Tenant AI quota exhausted / No credentials");

    const { data: examQuestion, error: examQuestionError } = await supabase.from("exam_questions")
      .select("question_type, published_question_text, published_options, published_answer_key, published_image_url, published_at")
      .eq("id", examQuestionId).single();

    if (examQuestionError || !examQuestion) throw new Error(`[VALIDATION] Exam question not found`);
    if (!examQuestion.published_at) throw new Error(`[VALIDATION] Question not published`);

    const resolvedCorrectAnswer = examQuestion.published_answer_key ?? "UNKNOWN";
    if (resolvedCorrectAnswer === "UNKNOWN") throw new Error("[VALIDATION] No answer key in published snapshot");

    let storagePath: string | null = examQuestion.published_image_url ?? null;
    if (!storagePath && examQuestion.published_options) {
      const metaOption = (examQuestion.published_options as any[]).find((o) => o.id === "__metadata__" || o.label === "__metadata__");
      if (metaOption?.text) {
        try { const meta = JSON.parse(metaOption.text); if (meta.stemImage) storagePath = meta.stemImage; } catch (_) {}
      }
    }

    const textLen = (examQuestion.published_question_text ?? "").trim().length;
    if (textLen === 0 && !storagePath) throw new Error("[VALIDATION] No text or image in question snapshot");

    let fileBuffer: Buffer | null = null;
    let mimeType = "";

    if (storagePath) {
      if (storagePath.startsWith("/uploads/") || storagePath.startsWith("/test_questions/")) {
        const fs = require("fs") as typeof import("fs");
        const path = require("path") as typeof import("path");
        const localPath = path.join(process.cwd(), "public", storagePath.replace(/^\//, ""));
        if (fs.existsSync(localPath)) fileBuffer = fs.readFileSync(localPath);
        else throw new Error(`[VALIDATION] Local file not found: ${storagePath}`);
      } else {
        const { data: fileData, error: downloadError } = await supabase.storage.from(BUCKET_NAME).download(storagePath);
        if (downloadError || !fileData) throw new Error(`[VALIDATION] Image download failed: ${downloadError?.message}`);
        fileBuffer = Buffer.from(await fileData.arrayBuffer());
      }
      mimeType = storagePath.toLowerCase().endsWith("webp") ? "image/webp" : "image/jpeg";
    }

    const formattedOptions = (examQuestion.published_options ?? [])
      .filter((o: any) => o.label !== "__metadata__")
      .map((o: any) => `${o.label}: ${o.text ?? ""}`)
      .join("\n");

    const understandingPrompt = `You are an expert exam question parser and solver.
Analyze the provided question.
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning in 'reasoning', and break it down into explicit steps in the 'steps' array. Each step should have a 'title', 'explanation', and optional 'equation' (in LaTeX without $$).
4. Output the exact derived mathematical or text answer in 'derived_answer' and 'finalAnswer.value'. DO NOT output A/B/C/D as the answer.
5. Extract the four options EXACTLY as written into 'extracted_options'. If NAT, leave null. Provide 'optionAnalysis' for each option, explaining why it is correct or wrong. If NAT, omit 'optionAnalysis'.
6. Provide a confidence score (0-100) for your understanding and solution.
7. Include a 'shortcut' if applicable, a 'commonMistake' students make, 'formulas' used, difficulty (EASY, MEDIUM, HARD), and 'estimatedSolveTime' (e.g. "2 mins").

DO NOT hallucinate. Do not guess. If incomplete, set confidence to 0.

Respond strictly in valid JSON:
{
  "subject": "string",
  "chapter": "string",
  "subchapter": "string",
  "concepts": ["string"],
  "summary": "string",
  "formulas": ["string"],
  "steps": [{"title": "string", "explanation": "string", "equation": "string | null"}],
  "shortcut": "string | null",
  "commonMistake": "string | null",
  "difficulty": "EASY | MEDIUM | HARD",
  "estimatedSolveTime": "string",
  "confidence": number,
  "reasoning": "string",
  "derived_answer": "string",
  "finalAnswer": {"value": "string", "option": "string | null"},
  "extracted_options": { "A": "string", "B": "string", "C": "string", "D": "string" },
  "optionAnalysis": [
    { "option": "A", "whyCorrect": "string | null", "whyWrong": "string | null" },
    { "option": "B", "whyCorrect": "string | null", "whyWrong": "string | null" },
    { "option": "C", "whyCorrect": "string | null", "whyWrong": "string | null" },
    { "option": "D", "whyCorrect": "string | null", "whyWrong": "string | null" }
  ]
}`;
    const promptText = `Question:\n${examQuestion.published_question_text ?? "Solve the following problem"}\n\nOptions:\n${formattedOptions}\n\n${understandingPrompt}`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME, generationConfig: { responseMimeType: "application/json" } });

    const geminiPayload: any[] = [];
    if (fileBuffer) geminiPayload.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });
    geminiPayload.push(promptText);

    let analysis: any;
    let validAnalysis = false;
    let validationError = "";

    for (let retry = 0; retry < 2; retry++) {
      log("GEMINI_CALL_START", { question_id: examQuestionId, model: MODEL_NAME, call: 1, attempt: retry + 1 });
      const result1 = await model.generateContent(geminiPayload);
      try {
        const rawText = result1.response.text();
        console.log("GEMINI RAW:", rawText);
        analysis = JSON.parse(rawText);
        const parsed = solutionMetadataSchema.safeParse(analysis);
        if (!parsed.success) {
          validationError = "Schema validation failed: " + parsed.error.message;
          throw new Error(validationError);
        }
        if (!analysis.subject || !analysis.chapter) {
          validationError = "Understanding validation failed (missing subject or chapter)";
          throw new Error(validationError);
        }
        validAnalysis = true;
        break; // Success
      } catch (err) {
        log("GEMINI_VALIDATION_ERROR", { attempt: retry + 1, error: String(err) });
        if (retry === 1) { // Final retry failed
          throw new Error(`[VALIDATION] JSON Parse or Validation failed after retries: ${String(err)}`);
        }
      }
    }
    
    if (!validAnalysis) {
      throw new Error(`[VALIDATION] ${validationError}`);
    }

    let finalModelAnswer = analysis.derived_answer ?? analysis.model_answer ?? "";
    if (examQuestion.question_type !== "NUMERICAL" && analysis.extracted_options) {
      const normalize = (s: string) => String(s).replace(/\s+/g, "").replace(/v/gi, "√").toLowerCase();
      const derived = normalize(finalModelAnswer);
      for (const [letter, optText] of Object.entries(analysis.extracted_options as Record<string, string>)) {
        if (normalize(optText) === derived) { finalModelAnswer = letter; break; }
      }
    }
    analysis.model_answer = finalModelAnswer;

    const studentModel = genAI.getGenerativeModel({ model: MODEL_NAME });
    const studentPrompt = `You are an expert JEE/NEET faculty.\nThe student needs a premium solution for this question. The correct answer is ${resolvedCorrectAnswer}.\nHere is the verified reasoning:\n${analysis.reasoning}\n\nFormat a clean, premium solution following these strict rules:\n1. Return EXACTLY three sections: **Approach:**, **Calculation:**, and **Final Answer:**. No introductory remarks.\n2. In **Approach:**, clearly state the concept used (${(analysis.concepts ?? []).join(", ")}) and the quick approach.\n3. In **Calculation:**, provide the essential steps.\n4. **Final Answer:** MUST be exactly ${resolvedCorrectAnswer}.\n\nReturn only the markdown text.`;

    log("GEMINI_CALL_START", { question_id: examQuestionId, model: MODEL_NAME, call: 2 });
    const result2 = await studentModel.generateContent(studentPrompt);
    const solutionText = result2.response.text();

    await supabase.rpc('commit_solution_and_job', {
      p_job_id: job.id, p_institute_id: job.institute_id, p_question_id: examQuestionId,
      p_version: 1, p_content_markdown: solutionText, p_final_answer: finalModelAnswer,
      p_answer_confidence: analysis.confidence || 0.9, p_provider: "Google",
      p_model_name: MODEL_NAME, p_prompt_version: PROMPT_VERSION,
      p_token_usage: { estimated: 1200 }, p_ai_metadata: analysis, p_tokens_used: 1200
    });

    // Belt-and-suspenders: commit_solution_and_job RPC does not set generation_status.
    // Patch it directly so any legacy code filtering by generation_status=COMPLETED still works.
    await supabase
      .from("question_solutions")
      .update({ generation_status: "COMPLETED" })
      .eq("question_id", examQuestionId)
      .eq("institute_id", job.institute_id);

    await refreshSolutionStatus(examQuestionId, job.institute_id);
    return { status: "COMPLETED", durationMs: Date.now() - startTime };

  } catch (err: any) {
    const errMessage = String(err.message || err);
    let nextStatus: WorkerResultStatus = "FAILED_PERMANENT";
    let nextRetryAt = null;

    const isPermanent = errMessage.includes("[VALIDATION]") || errMessage.includes("tenant");
    if (!isPermanent) {
      const backoffMs = Math.min(10_000 * currentAttempts, 60_000);
      nextStatus = "FAILED_RETRYABLE";
      nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
    }

    if (currentAttempts >= MAX_ATTEMPTS) {
      nextStatus = "FAILED_PERMANENT";
    }
    
    // Explicit 429 quota exhausted mapping to waiting budget if it's the free tier
    if (is429(err) && errMessage.includes("limit: 0")) {
      nextStatus = "WAITING_DAILY_BUDGET";
    } else if (is429(err)) {
      nextStatus = "FAILED_RETRYABLE"; 
      nextRetryAt = new Date(Date.now() + 60_000).toISOString();
    }

    const queueStatus = nextStatus === "FAILED_RETRYABLE" ? "WAITING_RETRY" : nextStatus === "FAILED_PERMANENT" ? "FAILED" : nextStatus;
    await updateQueueState(job.id, queueStatus, "EXECUTION", errMessage, currentAttempts, nextRetryAt);
    await refreshSolutionStatus(examQuestionId, job.institute_id);
    return { status: nextStatus, reason: errMessage };
  }
}

export async function runWorkerTick(): Promise<{ total: number; succeeded: number; failed: number }> {
  const workerId = crypto.randomUUID();
  await supabase.rpc('mark_timed_out_jobs', { p_timeout_minutes: 10 });

  const { data: lockAcquired } = await supabase.rpc('acquire_worker_lock', { p_worker_id: workerId, p_ttl_seconds: 60 });
  if (!lockAcquired) return { total: 0, succeeded: 0, failed: 0 };

  let total = 0, succeeded = 0, failed = 0;
  // mathematically 15 RPM limit -> 7 jobs max per minute since 2 requests per job
  const maxJobs = 7; 
  const startTime = Date.now();
  const TIME_LIMIT_MS = 45000; // 45 seconds to leave a 15s buffer before the 60s lock expires

  try {
    for (let i = 0; i < maxJobs; i++) {
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        console.log(`[GeminiWorker] Time bound reached. Breaking early to prevent lock expiration.`);
        break;
      }
      
      if (i > 0) {
        // Enforce a strict 8000ms interval between questions to maintain 15 RPM limit
        // (1 job = 2 requests, so 8s per job = 15 requests per minute exactly spread out)
        await new Promise(resolve => setTimeout(resolve, 8000));
      }

      // Check time limit again after sleep
      if (Date.now() - startTime > TIME_LIMIT_MS) {
        break;
      }

      const result = await runGeminiWorker(workerId);
      
      if (result.status === "NO_JOB") break;
      
      total++;
      if (result.status === "COMPLETED") succeeded++;
      else failed++;
    }
  } finally {
    await supabase.rpc('release_worker_lock', { p_worker_id: workerId });
  }

  return { total, succeeded, failed };
}


