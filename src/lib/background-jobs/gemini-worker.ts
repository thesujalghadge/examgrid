import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "cbt-assets";
const MODEL_NAME = "gemini-2.5-flash";
const PROMPT_VERSION = "v1.0-strict-vision";

// Lightweight Validation Logic
function validateSolution(text: string, expectedAnswer: string) {
  if (!text || text.length < 50) return { passed: false, reason: "Response too short or empty" };
  if (!text.includes("**Final Answer:**")) return { passed: false, reason: "Missing **Final Answer:** structure" };

  const finalAnswerBlock = text.split("**Final Answer:**")[1];
  if (!finalAnswerBlock) return { passed: false, reason: "No text after Final Answer block" };

  const containsAnswer = finalAnswerBlock.includes(expectedAnswer);
  if (!containsAnswer) {
    return { passed: false, reason: `Final answer block did not contain the expected answer: ${expectedAnswer}` };
  }

  return { passed: true };
}

export async function runGeminiWorker() {
  // 1. Fetch and Lock 1 queue item atomically using SKIP LOCKED RPC
  const { data: leasedJobs, error: queueError } = await supabase.rpc("lease_solution_generation_job_v2");

  if (queueError) {
    console.error("Failed to fetch queue item:", queueError);
    return { success: false, reason: "Queue fetch error" };
  }

  if (!leasedJobs || leasedJobs.length === 0) {
    return { success: true, processed: 0, reason: "Queue empty" };
  }

  const job = leasedJobs[0] as any;
  const assetId = job.test_question_asset_id;

  // We need to fetch the asset details since the RPC only returns the ID
  const { data: asset, error: assetError } = await supabase
    .from("test_question_assets")
    .select("exam_question_id, storage_path")
    .eq("id", assetId)
    .single();

  if (assetError || !asset) {
    await supabase.from("solution_generation_queue").update({ status: "FAILED", last_error: "Asset fetch failed" }).eq("id", job.id);
    return { success: false, reason: "Asset fetch error" };
  }

  const examQuestionId = asset.exam_question_id;
  const storagePath = asset.storage_path;

  try {
    // 2. Idempotency Check
    const { data: currentSolution } = await supabase
      .from("question_solutions")
      .select("generation_status, generation_attempts")
      .eq("test_question_asset_id", assetId)
      .maybeSingle();

    if (currentSolution?.generation_status === "COMPLETED") {
      await supabase.from("solution_generation_queue").update({ status: "COMPLETED" }).eq("id", job.id);
      return { success: true, processed: 1, reason: "Already COMPLETED" };
    }

    const attempts = (currentSolution?.generation_attempts || 0) + 1;

    // 3. Fetch Authoritative Phase 1 Answer
    const { data: examQuestion } = await supabase
      .from("exam_questions")
      .select("correct_option_id, correct_numerical_answer, type")
      .eq("id", examQuestionId)
      .single();

    if (!examQuestion) throw new Error("Phase 1 exam_question not found");

    let resolvedCorrectAnswer = "";
    if (examQuestion.type === "MCQ") {
      resolvedCorrectAnswer = examQuestion.correct_option_id || "UNKNOWN";
    } else {
      resolvedCorrectAnswer = examQuestion.correct_numerical_answer || "UNKNOWN";
    }

    if (resolvedCorrectAnswer === "UNKNOWN") {
      throw new Error("No authoritative answer key available from Phase 1 schema");
    }

    // 4. Download Buffer from Storage (No URL reliance)
    if (!storagePath) throw new Error("storage_path missing from test_question_assets");
    
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(BUCKET_NAME)
      .download(storagePath);

    if (downloadError || !fileData) throw new Error(`Failed to download buffer from ${storagePath}`);

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    const mimeType = storagePath.toLowerCase().endsWith("webp") ? "image/webp" : "image/jpeg";

    // 5. Construct Prompt
    const promptTemplate = `The exact correct answer to the question in this image is: "{ResolvedCorrectAnswer}".
Your task is to provide the step-by-step logical reasoning to arrive at this specific answer.
Do not conclude with any other answer.

Required Structure:
**Explanation:**
[Step-by-step logical breakdown]

**Final Answer:**
{ResolvedCorrectAnswer}`;

    const promptText = promptTemplate.replaceAll("{ResolvedCorrectAnswer}", resolvedCorrectAnswer);
    
    // TEXT ONLY prompt snapshot
    const promptSnapshot = `Model: ${MODEL_NAME}\nVersion: ${PROMPT_VERSION}\nAnswer Key: ${resolvedCorrectAnswer}\nInstruction: ${promptTemplate}`;

    // 6. Call Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL_NAME });

    const startTime = Date.now();
    const result = await model.generateContent([
      { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
      promptText
    ]);
    const durationMs = Date.now() - startTime;
    const solutionText = result.response.text();

    // 7. Validate Output
    const validation = validateSolution(solutionText, resolvedCorrectAnswer);

    // 8. Store Solution
    const finalStatus = validation.passed ? "COMPLETED" : "VALIDATION_FAILED";

    await supabase
      .from("question_solutions")
      .upsert({
        test_question_asset_id: assetId,
        question_id: examQuestionId,
        institute_id: job.institute_id,
        content_markdown: solutionText,
        is_active: true,
        generation_status: finalStatus,
        model_name: MODEL_NAME,
        prompt_version: PROMPT_VERSION,
        prompt_snapshot: promptSnapshot,
        generation_duration_ms: durationMs,
        generation_attempts: attempts,
        validation_passed: validation.passed,
        generated_at: new Date().toISOString()
      }, { onConflict: "test_question_asset_id" });

    // 9. Update Queue
    if (validation.passed) {
      await supabase.from("solution_generation_queue").update({ status: "COMPLETED", completed_at: new Date().toISOString() }).eq("id", job.id);
    } else {
      const nextQueueStatus = attempts >= 3 ? "FAILED" : "VALIDATION_FAILED";
      await supabase.from("solution_generation_queue").update({ status: nextQueueStatus, attempts }).eq("id", job.id);
    }

    return { 
      success: true, 
      processed: 1, 
      status: finalStatus, 
      validation_passed: validation.passed,
      attempts
    };

  } catch (error: any) {
    console.error("Gemini worker failed:", error);
    const isRateLimit = error.status === 429 || error.message.includes("429");
    const isNetwork = error.status === 500 || error.message.includes("fetch");
    
    // Calculate current attempt safely
    const currentAttempts = job.attempts + 1;
    let nextStatus = "FAILED";
    let nextRetryAt = undefined;

    if ((isRateLimit || isNetwork) && currentAttempts < 3) {
      nextStatus = "WAITING_RETRY";
      nextRetryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    }

    await supabase.from("solution_generation_queue").update({ 
      status: nextStatus,
      attempts: currentAttempts,
      last_error: error.message || String(error),
      next_retry_at: nextRetryAt
    }).eq("id", job.id);

    // Also track attempt natively on question_solutions if we can
    await supabase.from("question_solutions").upsert({
      test_question_asset_id: assetId,
      question_id: examQuestionId,
      institute_id: job.institute_id,
      is_active: false,
      generation_status: nextStatus,
      generation_attempts: currentAttempts,
      last_error: error.message || String(error)
    }, { onConflict: "test_question_asset_id" });

    return { success: false, reason: error.message, nextStatus };
  }
}
