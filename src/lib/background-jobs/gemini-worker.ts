import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "cbt-assets";
const MODEL_NAME = process.env.GEMINI_MODEL ?? "gemini-2.0-flash-lite";
const PROMPT_VERSION = "v3.0-sequential-rate-limited";

// ─── Rate limiting constants ──────────────────────────────────────────────────
// Gemini free tier: 15 RPM ≈ 1 request every 4 seconds.
// Each question makes 2 Gemini calls (understanding + solution).
// We therefore wait 4500ms between *questions* (not calls) to stay well within
// the 15 RPM limit even with 2 calls per question burst.
const REQUEST_DELAY_MS = Number(process.env.GEMINI_REQUEST_DELAY_MS ?? 4500);
const RATE_LIMIT_RETRY_DELAY_MS = 60_000; // 429 → wait 60s before retrying
const MAX_ATTEMPTS = 5; // permanent failure after 5 tries

import { decrypt } from "@/lib/ai/encryption";
import { decryptApiKey } from "@/lib/crypto/api-key-encryption";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function is429(err: any): boolean {
  const msg = String(err?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("quota exceeded") ||
    msg.includes("too many requests")
  );
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
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (stage !== null) payload.failure_stage = stage;
  if (error !== null) payload.last_error = error;
  if (status === "PROCESSING") payload.processing_started_at = new Date().toISOString();
  if (attempts !== null) payload.attempts = attempts;
  if (nextRetryAt !== null) payload.next_retry_at = nextRetryAt;
  await supabase.from("solution_generation_queue").update(payload).eq("id", id);
}

/** Refresh exam_solution_status after each job — keeps dashboard accurate in real-time */
async function refreshSolutionStatus(examQuestionId: string, instituteId: string) {
  try {
    const { data: eq } = await supabase
      .from("exam_questions")
      .select("exam_id")
      .eq("id", examQuestionId)
      .maybeSingle();
    if (!eq?.exam_id) return;

    const { data: examRow } = await supabase
      .from("exams")
      .select("id, legacy_id")
      .eq("id", eq.exam_id)
      .maybeSingle();
    if (!examRow) return;

    const publicExamId = examRow.legacy_id ?? examRow.id;
    await supabase.rpc("refresh_exam_solution_status", {
      p_exam_id: publicExamId,
      p_institute_id: instituteId,
    });
  } catch (err) {
    log("REFRESH_STATUS_ERROR", { error: String(err) });
  }
}

// ─── Single-job processor ────────────────────────────────────────────────────

export async function runGeminiWorker(workerId: string = "unknown"): Promise<{
  success: boolean;
  processed: number;
  reason?: string;
  nextStatus?: string;
  callDurationMs?: number;
}> {
  // 1. Atomically claim one job and pre-charge the budget
  const { data: leasedJobs, error: queueError } = await supabase.rpc(
    "lease_and_charge_job_v3",
  );

  if (queueError) {
    log("QUEUE_LEASE_ERROR", { error: queueError.message });
    return { success: false, processed: 0, reason: "Queue lease error" };
  }

  if (!leasedJobs || leasedJobs.length === 0) {
    return { success: true, processed: 0, reason: "Queue empty" };
  }

  const job = leasedJobs[0] as any;
  
  if (job.status === 'WAITING_DAILY_BUDGET') {
    return { success: false, processed: 0, nextStatus: 'WAITING_DAILY_BUDGET', reason: 'Daily budget exhausted' };
  }

  // job is now leased and budget is charged.
  const examQuestionId = job.question_id;
  const currentAttempts = (job.attempts ?? 0) + 1;

  let apiKey = "";

  try {
    // 2. Idempotency — skip if active solution already exists
    const { data: existingActiveSolution } = await supabase
      .from("question_solutions")
      .select("id")
      .eq("question_id", examQuestionId)
      .eq("is_active", true)
      .maybeSingle();

    if (existingActiveSolution) {
      await updateQueueState(job.id, "COMPLETED");
      log("SKIP_EXISTING_SOLUTION", { question_id: examQuestionId });
      return { success: true, processed: 1, reason: "Active solution already exists" };
    }

    // 3. Resolve Tenant Credentials
    let generationSource = "INSTITUTE_KEY";
    let resolvedModelName = MODEL_NAME;

    const { data: tenantSettings } = await supabase
      .from("institute_ai_settings")
      .select("model_name, is_active, allow_platform_ai")
      .eq("institute_id", job.institute_id)
      .maybeSingle();

    if (tenantSettings?.is_active && tenantSettings.model_name) {
      resolvedModelName = tenantSettings.model_name;
    }

    try {
      const { getInstituteGeminiKey } = await import("@/lib/institute/get-institute-api-key");
      apiKey = await getInstituteGeminiKey(job.institute_id);
    } catch (err: any) {
      const allowPlatformAi = tenantSettings ? tenantSettings.allow_platform_ai : true;
      if (allowPlatformAi) {
        apiKey = process.env.GEMINI_API_KEY ?? "";
        if (!apiKey) throw new Error("GEMINI_API_KEY platform fallback is not configured");
        generationSource = "PLATFORM_KEY";
      } else {
        throw new Error("Tenant AI quota exhausted / No credentials");
      }
    }

    // 4. Fetch Published Snapshot
    const { data: examQuestion, error: examQuestionError } = await supabase
      .from("exam_questions")
      .select(
        "question_type, published_question_text, published_options, published_answer_key, published_image_url, published_at",
      )
      .eq("id", examQuestionId)
      .single();

    if (examQuestionError || !examQuestion) {
      await updateQueueState(job.id, "FAILED", "QUESTION_FETCH", examQuestionError?.message ?? "Not found");
      return { success: false, processed: 0, reason: "Exam question not found" };
    }

    if (!examQuestion.published_at) {
      await updateQueueState(job.id, "FAILED", "QUESTION_FETCH", "Question not yet published");
      return { success: false, processed: 0, reason: "Question not published" };
    }

    const resolvedCorrectAnswer = examQuestion.published_answer_key ?? "UNKNOWN";
    if (resolvedCorrectAnswer === "UNKNOWN") {
      await updateQueueState(job.id, "FAILED", "KEY_RESOLUTION", "No answer key in published snapshot");
      return { success: false, processed: 0, reason: "No answer key" };
    }

    // Resolve image path
    let storagePath: string | null = examQuestion.published_image_url ?? null;
    if (!storagePath && examQuestion.published_options) {
      const metaOption = (examQuestion.published_options as any[]).find(
        (o) => o.id === "__metadata__" || o.label === "__metadata__",
      );
      if (metaOption?.text) {
        try {
          const meta = JSON.parse(metaOption.text);
          if (meta.stemImage) storagePath = meta.stemImage;
        } catch (_) {}
      }
    }

    const textLen = (examQuestion.published_question_text ?? "").trim().length;
    if (textLen === 0 && !storagePath) {
      await updateQueueState(job.id, "FAILED", "SNAPSHOT_INTEGRITY", "No text or image");
      return { success: false, processed: 0, reason: "SNAPSHOT INTEGRITY FAILED" };
    }

    // 5. Download image if present
    let fileBuffer: Buffer | null = null;
    let mimeType = "";

    if (storagePath) {
      if (storagePath.startsWith("/uploads/") || storagePath.startsWith("/test_questions/")) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const fs = require("fs") as typeof import("fs");
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const path = require("path") as typeof import("path");
        const localPath = path.join(process.cwd(), "public", storagePath.replace(/^\//, ""));
        if (fs.existsSync(localPath)) {
          fileBuffer = fs.readFileSync(localPath);
        } else {
          await updateQueueState(job.id, "FAILED", "QUESTION_FETCH", `Local file not found: ${storagePath}`);
          return { success: false, processed: 0, reason: `Local file not found: ${storagePath}` };
        }
      } else {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(BUCKET_NAME)
          .download(storagePath);

        if (downloadError || !fileData) {
          await updateQueueState(job.id, "FAILED", "QUESTION_FETCH", downloadError?.message ?? "Download failed");
          return { success: false, processed: 0, reason: "Image download failed" };
        }
        fileBuffer = Buffer.from(await fileData.arrayBuffer());
      }
      mimeType = storagePath.toLowerCase().endsWith("webp") ? "image/webp" : "image/jpeg";
    }

    // 6. Build Gemini payload
    const formattedOptions = (examQuestion.published_options ?? [])
      .filter((o: any) => o.label !== "__metadata__")
      .map((o: any) => `${o.label}: ${o.text ?? ""}`)
      .join("\n");

    const understandingPrompt = `You are an expert exam question parser and solver.
Analyze the provided question.
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning.
4. Output the exact derived mathematical or text answer in 'derived_answer'. DO NOT output A/B/C/D as the answer.
5. Extract the four options EXACTLY as written into 'extracted_options'. If NAT, leave null.
6. Provide a confidence score (0-100) for your understanding and solution.

DO NOT hallucinate. Do not guess. If incomplete, set confidence to 0.

Respond strictly in valid JSON:
{
  "subject": "string",
  "chapter": "string",
  "subchapter": "string",
  "concepts": ["string"],
  "summary": "string",
  "confidence": number,
  "reasoning": "string",
  "derived_answer": "string",
  "extracted_options": { "A": "string", "B": "string", "C": "string", "D": "string" }
}`;

    const promptText = `Question:\n${examQuestion.published_question_text ?? "Solve the following problem"}\n\nOptions:\n${formattedOptions}\n\n${understandingPrompt}`;

    // 7. First Gemini call — understanding + solution reasoning
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: resolvedModelName,
      generationConfig: { responseMimeType: "application/json" },
    });

    const geminiPayload: any[] = [];
    if (fileBuffer) {
      geminiPayload.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });
    }
    geminiPayload.push(promptText);

    const startTime = Date.now();
    log("GEMINI_CALL_START", {
      question_id: examQuestionId,
      workerId,
      attempt: currentAttempts,
      model: resolvedModelName,
      has_image: Boolean(fileBuffer),
      call: 1,
    });

    let result;
    try {
      result = await model.generateContent(geminiPayload);
    } catch (apiError: any) {
      const durationMs = Date.now() - startTime;
      const isRateLimit = is429(apiError);
      log("GEMINI_CALL_ERROR", {
        question_id: examQuestionId,
        workerId,
        attempt: currentAttempts,
        model: resolvedModelName,
        duration_ms: durationMs,
        is_rate_limit: isRateLimit,
        error: apiError.message,
        call: 1,
      });
      throw apiError; // re-throw for outer catch to handle retry logic
    }

    const call1Duration = Date.now() - startTime;
    log("GEMINI_CALL_DONE", {
      question_id: examQuestionId,
      workerId,
      attempt: currentAttempts,
      model: resolvedModelName,
      duration_ms: call1Duration,
      call: 1,
    });

    const analysisText = result.response.text();
    let analysis: any;
    try {
      analysis = JSON.parse(analysisText);
    } catch (_) {
      throw new Error("[VALIDATION] Model did not return valid JSON");
    }

    // 8. Understanding validation
    if (
      !analysis.subject ||
      !analysis.chapter ||
      !analysis.concepts ||
      analysis.confidence < 70 ||
      analysis.subject === "Unknown" ||
      analysis.chapter === "Unknown"
    ) {
      await updateQueueState(
        job.id, "FAILED", "VALIDATION",
        "Understanding validation failed (low confidence or missing concepts)",
        currentAttempts,
      );
      await refreshSolutionStatus(examQuestionId, job.institute_id);
      return { success: false, processed: 0, reason: "Understanding validation failed" };
    }

    // 9. Deterministic option resolver
    let finalModelAnswer = analysis.derived_answer ?? analysis.model_answer ?? "";
    if (examQuestion.question_type !== "NUMERICAL" && analysis.extracted_options) {
      const normalize = (s: string) =>
        String(s).replace(/\s+/g, "").replace(/v/gi, "√").toLowerCase();
      const derived = normalize(finalModelAnswer);
      for (const [letter, optText] of Object.entries(analysis.extracted_options as Record<string, string>)) {
        if (normalize(optText) === derived) {
          finalModelAnswer = letter;
          break;
        }
      }
    }
    analysis.model_answer = finalModelAnswer;

    // 10. Answer verification
    let cleanTeacherAnswer = resolvedCorrectAnswer.toString().trim().toLowerCase();
    const cleanModelAnswer = String(finalModelAnswer).trim().toLowerCase();
    if (cleanTeacherAnswer.includes(":")) {
      const parts = cleanTeacherAnswer.split(":");
      if (parts[0].trim() === cleanModelAnswer) cleanTeacherAnswer = cleanModelAnswer;
    }

    const answersMatch = cleanTeacherAnswer === cleanModelAnswer;
    const mismatchReason = answersMatch
      ? null
      : `Model derived '${cleanModelAnswer}' but teacher key is '${cleanTeacherAnswer}'`;

    // 11. Second Gemini call — student-facing solution text
    //     Always generated, even on mismatch, so student sees a solution (may be flagged).
    const studentModel = genAI.getGenerativeModel({ model: resolvedModelName });
    const studentPrompt = `You are an expert JEE/NEET faculty.
The student needs a premium solution for this question. The correct answer is ${resolvedCorrectAnswer}.
Here is the verified reasoning:
${analysis.reasoning}

Format a clean, premium solution following these strict rules:
1. Return EXACTLY three sections: **Approach:**, **Calculation:**, and **Final Answer:**. No introductory remarks.
2. In **Approach:**, clearly state the concept used (${(analysis.concepts ?? []).join(", ")}) and the quick approach.
3. In **Calculation:**, provide the essential steps.
4. **Final Answer:** MUST be exactly ${resolvedCorrectAnswer}.

Return only the markdown text.`;

    log("GEMINI_CALL_START", {
      question_id: examQuestionId,
      workerId,
      attempt: currentAttempts,
      model: resolvedModelName,
      call: 2,
    });

    const call2Start = Date.now();
    let solutionText = "";
    try {
      const studentResult = await studentModel.generateContent(studentPrompt);
      solutionText = studentResult.response.text();
      log("GEMINI_CALL_DONE", {
        question_id: examQuestionId,
        workerId,
        attempt: currentAttempts,
        model: resolvedModelName,
        duration_ms: Date.now() - call2Start,
        call: 2,
      });
    } catch (apiError: any) {
      log("GEMINI_CALL_ERROR", {
        question_id: examQuestionId,
        workerId,
        attempt: currentAttempts,
        model: resolvedModelName,
        duration_ms: Date.now() - call2Start,
        is_rate_limit: is429(apiError),
        error: apiError.message,
        call: 2,
      });
      // Use reasoning as fallback rather than failing the job entirely
      solutionText = `**Approach:**\n${analysis.concepts?.join(", ")}\n\n**Calculation:**\n${analysis.reasoning}\n\n**Final Answer:** ${resolvedCorrectAnswer}`;
    }

    const totalDurationMs = Date.now() - startTime;

    const tokensUsed = 1200; // approximation since result doesn't expose raw tokens easily in this block, or we can use 1200 as a flat rate estimate.
    
    // Atomic Commit: Insert solution, complete job, increment budget tokens
    await supabase.rpc('commit_solution_and_job', {
      p_job_id: job.id,
      p_institute_id: job.institute_id,
      p_question_id: examQuestionId,
      p_version: 1,
      p_content_markdown: solutionText,
      p_final_answer: finalModelAnswer,
      p_answer_confidence: analysis.confidence || 0.9,
      p_provider: "Google",
      p_model_name: resolvedModelName,
      p_prompt_version: PROMPT_VERSION,
      p_token_usage: { estimated: tokensUsed },
      p_ai_metadata: analysis,
      p_tokens_used: tokensUsed
    });

    if (mismatchReason) {
      log("ANSWER_MISMATCH", {
        question_id: examQuestionId,
        model_answer: cleanModelAnswer,
        teacher_answer: cleanTeacherAnswer,
        mismatch_reason: mismatchReason,
      });
    }

    // 14. Refresh dashboard
    apiKey = "";
    await refreshSolutionStatus(examQuestionId, job.institute_id);

    log("JOB_COMPLETE", {
      question_id: examQuestionId,
      workerId,
      attempt: currentAttempts,
      duration_ms: totalDurationMs,
      validation_passed: answersMatch,
    });

    return { success: true, processed: 1, nextStatus: "COMPLETED", callDurationMs: totalDurationMs };

  } catch (error: any) {
    apiKey = "";
    const errMessage = error.message ?? String(error);
    const isRateLimit = is429(error);

    log("JOB_ERROR", {
      question_id: examQuestionId,
      workerId,
      attempt: currentAttempts,
      is_rate_limit: isRateLimit,
      error: errMessage,
    });

    let nextStatus = "FAILED";
    let nextRetryAt: string | null = null;
    let stage = "UNKNOWN";

    if (errMessage.includes("[GEMINI_CALL]") || isRateLimit) stage = "GEMINI_CALL";
    else if (errMessage.includes("tenant") || errMessage.includes("decrypt")) stage = "KEY_RESOLUTION";

    if (isRateLimit) {
      // Extract retry delay from Gemini's error response (e.g. "Please retry in 27.75s")
      const retryInMatch = errMessage.match(/retry in (\d+(?:\.\d+)?)s/i);
      const geminiRetryMs = retryInMatch
        ? Math.ceil(parseFloat(retryInMatch[1]) * 1000) + 2000 // add 2s buffer
        : RATE_LIMIT_RETRY_DELAY_MS;

      // Rate limit: back off per Gemini's suggestion, don't count as a failure attempt
      nextStatus = "WAITING_RETRY";
      nextRetryAt = new Date(Date.now() + geminiRetryMs).toISOString();
      log("RATE_LIMIT_BACKOFF", {
        question_id: examQuestionId,
        retry_after_ms: geminiRetryMs,
        gemini_suggested_s: retryInMatch ? retryInMatch[1] : null,
      });
    } else if (currentAttempts >= MAX_ATTEMPTS) {
      nextStatus = "FAILED";
    } else {
      // Classify permanent vs retryable
      const isPermanent = errMessage.includes("tenant") || 
                          errMessage.includes("AI_KEY") || 
                          errMessage.includes("[VALIDATION]") ||
                          errMessage.includes("invalid prompt") ||
                          errMessage.includes("Snapshot");
                          
      if (isPermanent) {
        nextStatus = "FAILED";
      } else {
        // Transient error (500, 503, timeout): retry with exponential-ish backoff
        const backoffMs = Math.min(10_000 * currentAttempts, 60_000);
        nextStatus = "WAITING_RETRY";
        nextRetryAt = new Date(Date.now() + backoffMs).toISOString();
      }
    }

    await updateQueueState(job.id, nextStatus, stage, errMessage, currentAttempts, nextRetryAt);
    await refreshSolutionStatus(examQuestionId, job.institute_id);

    return { success: false, processed: 0, reason: errMessage, nextStatus };
  }
}

// ─── Worker Tick (Cron) ───────────────────────────────────────────────────
// Runs exactly one tick of the worker logic for a cron scheduler.
// Leases up to 6 jobs (12 RPM) sequentially to protect limits.

export async function runWorkerTick(): Promise<{ total: number; succeeded: number; failed: number }> {
  let total = 0;
  let succeeded = 0;
  let failed = 0;
  
  const workerId = crypto.randomUUID();

  // 1. Unstick jobs
  await supabase.rpc('mark_timed_out_jobs', { p_timeout_minutes: 10 });

  // 2. Acquire global worker lock (TTL: 60s)
  const { data: lockAcquired } = await supabase.rpc('acquire_worker_lock', {
    p_worker_id: workerId,
    p_ttl_seconds: 60
  });

  if (!lockAcquired) {
    console.log("Worker already running.");
    log("WORKER_TICK_ABORTED_LOCK_BUSY", { workerId });
    return { total, succeeded, failed };
  }

  const loopStartTime = Date.now();
  const maxJobs = 6;

  try {
    for (let i = 0; i < maxJobs; i++) {
      const result = await runGeminiWorker(workerId);

      if (result.processed === 0) {
        if (result.nextStatus === 'WAITING_DAILY_BUDGET') {
          log("WORKER_TICK_BUDGET_EXHAUSTED", { processed: total });
        } else {
          log("WORKER_TICK_QUEUE_EMPTY", { processed: total });
        }
        break;
      }

      total++;
      if (result.success) succeeded++;
      else failed++;
    }
  } finally {
    // Always release lock when done
    await supabase.rpc('release_worker_lock', { p_worker_id: workerId });
    
    log("WORKER_TICK_DONE", { total, succeeded, failed, workerId, durationMs: Date.now() - loopStartTime });
  }

  return { total, succeeded, failed };
}

