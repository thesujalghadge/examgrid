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

import { decrypt } from "@/lib/ai/encryption";

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

  // We need to fetch the question_id since the RPC only returns the ID and asset_id
  const { data: queueItem, error: queueItemError } = await supabase
    .from("solution_generation_queue")
    .select("question_id, test_question_asset_id")
    .eq("id", job.id)
    .single();

  if (queueItemError || !queueItem) {
    await supabase.from("solution_generation_queue").update({ status: "FAILED", last_error: "Queue item fetch failed" }).eq("id", job.id);
    return { success: false, reason: "Queue item fetch error" };
  }

  const examQuestionId = queueItem.question_id;
  const assetId = queueItem.test_question_asset_id;

  let storagePath = null;
  if (assetId) {
    const { data: asset, error: assetError } = await supabase
      .from("test_question_assets")
      .select("storage_path")
      .eq("id", assetId)
      .single();

    if (assetError || !asset) {
      await supabase.from("solution_generation_queue").update({ status: "FAILED", last_error: "Asset fetch failed" }).eq("id", job.id);
      return { success: false, reason: "Asset fetch error" };
    }
    storagePath = asset.storage_path;
  }

  let apiKey = "";

  try {
    // 2. Strict Idempotency Check (Skip if active solution exists for question_id)
    const { data: existingActiveSolution } = await supabase
      .from("question_solutions")
      .select("id, generation_attempts")
      .eq("question_id", examQuestionId)
      .eq("is_active", true)
      .maybeSingle();

    if (existingActiveSolution) {
      await supabase.from("solution_generation_queue").update({ status: "COMPLETED" }).eq("id", job.id);
      return { success: true, processed: 1, reason: "Active solution already exists" };
    }

    const attempts = ((existingActiveSolution as any)?.generation_attempts || 0) + 1;

    // 3. Resolve Tenant Credentials
    const { data: tenantSettings } = await supabase
      .from("institute_ai_settings")
      .select("*")
      .eq("institute_id", job.institute_id)
      .maybeSingle();

    let generationSource = "";
    let resolvedModelName = MODEL_NAME;

    if (tenantSettings && tenantSettings.is_active && tenantSettings.encrypted_api_key) {
      try {
        const secret = process.env.AI_KEY_ENCRYPTION_SECRET;
        if (!secret) throw new Error("AI_KEY_ENCRYPTION_SECRET is missing");
        apiKey = decrypt(tenantSettings.encrypted_api_key, secret);
        generationSource = "INSTITUTE_KEY";
        resolvedModelName = tenantSettings.model_name || MODEL_NAME;
      } catch (err) {
        throw new Error("Failed to decrypt institute API key");
      }
    } else {
      // Check platform fallback
      const allowPlatformAi = tenantSettings ? tenantSettings.allow_platform_ai : true; // Default true as per schema
      if (allowPlatformAi) {
        apiKey = process.env.GEMINI_API_KEY || "";
        if (!apiKey) throw new Error("GEMINI_API_KEY platform fallback is not configured");
        generationSource = "PLATFORM_KEY";
      } else {
        throw new Error("Tenant AI quota exhausted / No credentials");
      }
    }

    // 4. Fetch Authoritative Phase 1 Answer
    const { data: examQuestion } = await supabase
      .from("exam_questions")
      .select("correct_option_id, correct_numerical_answer, type, question_text, options")
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

    let fileBuffer: Buffer | null = null;
    let mimeType = "";

    // 5. Download Buffer from Storage (if asset exists)
    if (storagePath) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from(BUCKET_NAME)
        .download(storagePath);

      if (downloadError || !fileData) throw new Error(`Failed to download buffer from ${storagePath}`);

      fileBuffer = Buffer.from(await fileData.arrayBuffer());
      mimeType = storagePath.toLowerCase().endsWith("webp") ? "image/webp" : "image/jpeg";
    }

    // 6. Construct Prompt
    let promptTemplate = "";
    if (fileBuffer) {
      promptTemplate = `The exact correct answer to the question in this image is: "{ResolvedCorrectAnswer}".
Your task is to provide the step-by-step logical reasoning to arrive at this specific answer.
Do not conclude with any other answer.

Required Structure:
**Explanation:**
[Step-by-step logical breakdown]

**Final Answer:**
{ResolvedCorrectAnswer}`;
    } else {
      const formattedOptions = (examQuestion.options || [])
        .map((o: any) => `${o.label}: ${o.text || ""}`)
        .join("\n");
        
      promptTemplate = `Question:
${examQuestion.question_text || "Solve the following problem"}

Options:
${formattedOptions}

The exact correct answer to this question is: "{ResolvedCorrectAnswer}".
Your task is to provide the step-by-step logical reasoning to arrive at this specific answer.
Do not conclude with any other answer.

Required Structure:
**Explanation:**
[Step-by-step logical breakdown]

**Final Answer:**
{ResolvedCorrectAnswer}`;
    }

    const promptText = promptTemplate.replaceAll("{ResolvedCorrectAnswer}", resolvedCorrectAnswer);
    
    // TEXT ONLY prompt snapshot
    const promptSnapshot = `Model: ${resolvedModelName}\nVersion: ${PROMPT_VERSION}\nAnswer Key: ${resolvedCorrectAnswer}\nInstruction: ${promptTemplate}`;

    // 7. Call Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: resolvedModelName });

    const startTime = Date.now();
    let result;
    if (fileBuffer) {
      result = await model.generateContent([
        { inlineData: { data: fileBuffer.toString("base64"), mimeType } },
        promptText
      ]);
    } else {
      result = await model.generateContent(promptText);
    }
    const durationMs = Date.now() - startTime;
    const solutionText = result.response.text();

    // 8. Validate Output
    const validation = validateSolution(solutionText, resolvedCorrectAnswer);

    // 9. Store Solution
    const finalStatus = validation.passed ? "COMPLETED" : "VALIDATION_FAILED";

    // but the schema is ready (version, superseded_at). For now we just insert version=1.
    const payload: any = {
      test_question_asset_id: assetId,
      question_id: examQuestionId,
      institute_id: job.institute_id,
      content_markdown: solutionText,
      is_active: true,
      generation_status: finalStatus,
      model_name: resolvedModelName,
      generation_source: generationSource,
      generated_model: resolvedModelName,
      version: 1,
      prompt_version: PROMPT_VERSION,
      prompt_snapshot: promptSnapshot,
      generation_duration_ms: durationMs,
      generation_attempts: attempts,
      validation_passed: validation.passed,
      generated_at: new Date().toISOString()
    };
    
    await supabase
      .from("question_solutions")
      .upsert(payload, { onConflict: "test_question_asset_id" });

    // 10. Clear Memory
    apiKey = "";

    // 11. Update Queue
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
    apiKey = ""; // Clear on failure
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
    const errorPayload: any = {
      test_question_asset_id: assetId,
      question_id: examQuestionId,
      institute_id: job.institute_id,
      is_active: false,
      generation_status: nextStatus,
      generation_attempts: currentAttempts,
      last_error: error.message || String(error)
    };
    await supabase.from("question_solutions").upsert(errorPayload, { onConflict: "test_question_asset_id" });

    return { success: false, reason: error.message, nextStatus };
  }
}
