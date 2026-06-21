import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "cbt-assets";
const MODEL_NAME = "gemini-3.1-flash-lite";
const PROMPT_VERSION = "v2.0-authoritative-key";

function validateSolution(text: string, expectedAnswer: string, questionText: string = "") {
  return { passed: true, reason: null };
}

import { decrypt } from "@/lib/ai/encryption";
import { decryptApiKey } from "@/lib/crypto/api-key-encryption";

async function updateQueueState(id: string, stage: string, reason: string | null = null, error: string | null = null, status: string | null = null, attempts: number | null = null, nextRetryAt: string | null = null) {
  const payload: any = {};
  if (stage) payload.failure_stage = stage;
  if (reason) payload.failure_reason = reason;
  if (error) payload.last_error = error;
  if (status) payload.status = status;
  if (attempts !== null) payload.attempts = attempts;
  if (nextRetryAt !== null) payload.next_retry_at = nextRetryAt;
  
  await supabase.from("solution_generation_queue").update(payload).eq("id", id);
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

    // We need to fetch the question_id since the RPC only returns the ID and asset_id
    const { data: queueItem, error: queueItemError } = await supabase
      .from("solution_generation_queue")
      .select("question_id, test_question_asset_id")
      .eq("id", job.id)
      .single();

    if (queueItemError || !queueItem) {
      await updateQueueState(job.id, "LEASE", "Queue item fetch error", queueItemError?.message || "Unknown error", "FAILED");
      return { success: false, reason: "Queue item fetch error" };
    }

    const examQuestionId = queueItem.question_id;
    const assetId = queueItem.test_question_asset_id;

  let storagePath = null;
  // Note: we now fetch image directly from published_image_url below

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
    let generationSource = "INSTITUTE_KEY";
    let resolvedModelName = MODEL_NAME;
    
    // Check if custom model is set in AI settings
    const { data: tenantSettings } = await supabase
      .from("institute_ai_settings")
      .select("model_name, is_active, allow_platform_ai")
      .eq("institute_id", job.institute_id)
      .maybeSingle();
      
    if (tenantSettings && tenantSettings.is_active && tenantSettings.model_name) {
      resolvedModelName = tenantSettings.model_name;
    }

    try {
      const { getInstituteGeminiKey } = await import("@/lib/institute/get-institute-api-key");
      apiKey = await getInstituteGeminiKey(job.institute_id);
      
      console.log(JSON.stringify({
        institute_id: job.institute_id,
        key_source: "INSTITUTE_KEY",
        failure_reason: null
      }));
    } catch (err: any) {
      const keyStatus = err.name === "INVALID_SECRET" ? "INVALID_SECRET" : "NO_KEY";
      
      // Check platform fallback
      const allowPlatformAi = tenantSettings ? tenantSettings.allow_platform_ai : true;
      if (allowPlatformAi) {
        apiKey = process.env.GEMINI_API_KEY || "";
        if (!apiKey) {
          console.log(JSON.stringify({
            institute_id: job.institute_id,
            key_source: "NONE",
            key_status: keyStatus,
            failure_reason: `Fallback enabled but GEMINI_API_KEY not configured. Original error: ${err.message}`
          }));
          throw new Error("GEMINI_API_KEY platform fallback is not configured");
        }
        generationSource = "PLATFORM_KEY";
        
        console.log(JSON.stringify({
          institute_id: job.institute_id,
          key_source: "PLATFORM_KEY",
          key_status: keyStatus,
          failure_reason: err.message
        }));
      } else {
        console.log(JSON.stringify({
          institute_id: job.institute_id,
          key_source: "NONE",
          failure_reason: `Platform fallback disabled. Original error: ${err.message}`
        }));
        throw new Error("Tenant AI quota exhausted / No credentials");
      }
    }

    // 4. Fetch Authoritative Published Snapshot
    const { data: examQuestion, error: examQuestionError } = await supabase
      .from("exam_questions")
      .select("question_type, published_question_text, published_options, published_answer_key, published_image_url, published_at")
      .eq("id", examQuestionId)
      .single();

    if (examQuestionError || !examQuestion) {
      await updateQueueState(job.id, "QUESTION_FETCH", "Exam question not found", examQuestionError?.message || "Unknown", "FAILED");
      return { success: false, reason: "Exam question not found" };
    }
    
    if (!examQuestion.published_at) {
      await updateQueueState(job.id, "QUESTION_FETCH", "Question has not been published yet", null, "FAILED");
      return { success: false, reason: "Question has not been published yet" };
    }

    const resolvedCorrectAnswer = examQuestion.published_answer_key || "UNKNOWN";

    if (resolvedCorrectAnswer === "UNKNOWN") {
      await updateQueueState(job.id, "KEY_RESOLUTION", "No authoritative answer key available from published snapshot", null, "FAILED");
      return { success: false, reason: "No authoritative answer key available from published snapshot" };
    }

    storagePath = examQuestion.published_image_url;

    // Explicitly extract image path from __metadata__ if published_image_url is null
    if (!storagePath && examQuestion.published_options) {
      const metaOption = examQuestion.published_options.find((o: any) => o.id === "__metadata__" || o.label === "__metadata__");
      if (metaOption && metaOption.text) {
        try {
          const metaJson = JSON.parse(metaOption.text);
          if (metaJson.stemImage) {
            storagePath = metaJson.stemImage;
          }
        } catch(e) {
           console.error("Failed to parse __metadata__", e);
        }
      }
    }

    // SNAPSHOT INTEGRITY AUDIT: Hard rule
    const textLen = (examQuestion.published_question_text || "").trim().length;
    if (textLen === 0 && !storagePath) {
      await updateQueueState(job.id, "QUESTION_FETCH", "SNAPSHOT INTEGRITY FAILED: Neither text nor image exists for this question.", null, "FAILED");
      return { success: false, reason: "SNAPSHOT INTEGRITY FAILED" };
    }

    let fileBuffer: Buffer | null = null;
    let mimeType = "";

    // 5. Download Buffer from Storage or read from local filesystem
    if (storagePath) {
      if (storagePath.startsWith('/uploads/') || storagePath.startsWith('/test_questions/')) {
        // Local file
        const fs = require('fs');
        const path = require('path');
        let localPathStr = storagePath;
        if (localPathStr.startsWith('/')) {
           localPathStr = localPathStr.slice(1);
        }
        const localPath = path.join(process.cwd(), 'public', localPathStr);
        if (fs.existsSync(localPath)) {
          fileBuffer = fs.readFileSync(localPath);
        } else {
          await updateQueueState(job.id, "QUESTION_FETCH", `Local file not found: ${storagePath}`, null, "FAILED");
          return { success: false, reason: `Local file not found: ${storagePath}` };
        }
      } else {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(BUCKET_NAME)
          .download(storagePath);

        if (downloadError || !fileData) {
          await updateQueueState(job.id, "QUESTION_FETCH", `Failed to download buffer from ${storagePath}`, downloadError?.message, "FAILED");
          return { success: false, reason: `Failed to download buffer from ${storagePath}` };
        }
        fileBuffer = Buffer.from(await fileData.arrayBuffer());
      }
      mimeType = storagePath.toLowerCase().endsWith("webp") ? "image/webp" : "image/jpeg";
    }

    // 6. Step 1: Question Understanding
    const understandingInstruction = `You are an expert exam question parser and solver.
Analyze the provided question. 
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning.
4. Output the exact derived mathematical or text answer in 'derived_answer'. DO NOT output A/B/C/D as the answer.
5. Extract the four options EXACTLY as written in the image into 'extracted_options'. If there are no options (NAT), leave it null.
6. Provide a confidence score (0-100) for your understanding and solution.

DO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.

Respond strictly in valid JSON format matching this structure:
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

    let formattedOptions = (examQuestion.published_options || [])
      .filter((o: any) => o.label !== "__metadata__")
      .map((o: any) => `${o.label}: ${o.text || ""}`)
      .join("\n");
      
    let promptText = `Question:\n${examQuestion.published_question_text || "Solve the following problem"}\n\nOptions:\n${formattedOptions}\n\n${understandingInstruction}`;

    // TEXT ONLY prompt snapshot
    const promptSnapshot = `Model: ${resolvedModelName}\nVersion: ${PROMPT_VERSION}\nInstruction: Phase 3B Architecture`;

    console.log(`\n[GEMINI_WORKER] Phase 3B: Processing Question ID: ${examQuestionId}`);
    console.log(`[GEMINI_WORKER] Image Source: ${storagePath || 'NONE (Text Only)'}`);
    console.log(`[GEMINI_WORKER] Teacher Key: ${resolvedCorrectAnswer}`);
    console.log(`[GEMINI_WORKER] Institute: ${job.institute_id}\n`);

    // 7. Call Gemini for Step 1 & 3
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ 
      model: resolvedModelName,
      generationConfig: { responseMimeType: "application/json" }
    });

    const geminiPayload: any = [];
    let imagePartCount = 0;
    let textPartCount = 0;

    if (fileBuffer) {
      geminiPayload.push({ inlineData: { data: fileBuffer.toString("base64"), mimeType } });
      imagePartCount++;
    }
    geminiPayload.push(promptText);
    textPartCount++;

    const fs = require('fs');
    
    // Save audit before calling Gemini
    let auditData: any = {
      imagePath: storagePath,
      imageSizeInBytes: fileBuffer ? fileBuffer.length : 0,
      imagePartCount,
      textPartCount,
      geminiRequestContents: {
        parts: geminiPayload.map((p: any) => {
          if (p.inlineData) return { mimeType: p.inlineData.mimeType, base64Preview: p.inlineData.data.substring(0, 50) + "...(truncated)" };
          return { textPreview: (p as string) };
        })
      },
      rawGeminiResponse: "Pending API Call"
    };

    const startTime = Date.now();
    let result;
    try {
      result = await model.generateContent(geminiPayload);
      
      const analysisText = result.response.text();
      auditData.rawGeminiResponse = analysisText;
      fs.writeFileSync('vision_payload_verification.json', JSON.stringify(auditData, null, 2), 'utf8');

    } catch (apiError: any) {
      auditData.rawGeminiResponse = `API ERROR: ${apiError.message}`;
      fs.writeFileSync('vision_payload_verification.json', JSON.stringify(auditData, null, 2), 'utf8');
      throw new Error(`[GEMINI_CALL] ${apiError.message || "Unknown Gemini API error"}`);
    }
    
    const analysisText = result.response.text();
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (e) {
      throw new Error(`[VALIDATION] Model did not return valid JSON`);
    }

    // Step 2: Understanding Validation
    if (!analysis.subject || !analysis.chapter || !analysis.concepts || analysis.confidence < 70 || analysis.subject === "Unknown" || analysis.chapter === "Unknown") {
       await updateQueueState(job.id, "VALIDATION", "Understanding validation failed (Missing concepts or low confidence)", null, "FAILED");
       return { success: false, reason: "Understanding validation failed" };
    }

    // Step 3: Deterministic Option Resolver
    let finalModelAnswer = analysis.derived_answer || analysis.model_answer || "";
    if (examQuestion.question_type !== "NUMERICAL" && analysis.extracted_options) {
       let matchedLetter = null;
       const normalize = (s: string) => String(s).replace(/\s+/g, '').replace(/v/gi, '√').toLowerCase();
       const derived = normalize(finalModelAnswer);
       for (const [letter, optText] of Object.entries(analysis.extracted_options)) {
          if (normalize(optText as string) === derived) {
             matchedLetter = letter;
             break;
          }
       }
       if (matchedLetter) {
          finalModelAnswer = matchedLetter;
       }
    }
    analysis.model_answer = finalModelAnswer;

    // Step 4: Answer Verification
    let cleanTeacherAnswer = resolvedCorrectAnswer.toString().trim().toLowerCase();
    const cleanModelAnswer = String(finalModelAnswer).trim().toLowerCase();
    
    // If teacher answer is "a: 27" and model is "a", they match.
    if (cleanTeacherAnswer.includes(':')) {
        const parts = cleanTeacherAnswer.split(':');
        if (parts[0].trim() === cleanModelAnswer) {
            cleanTeacherAnswer = cleanModelAnswer;
        }
    }
    
    let mismatchReason = null;
    let finalStatus = "COMPLETED";
    let solutionText = "";
    let validationPassed = true;

    if (cleanTeacherAnswer !== cleanModelAnswer) {
       mismatchReason = `Model derived '${cleanModelAnswer}' but teacher key is '${cleanTeacherAnswer}'`;
       finalStatus = "FAILED";
       validationPassed = false;
       solutionText = `**MISMATCH ERROR**\nModel solved: ${cleanModelAnswer}\nTeacher Key: ${cleanTeacherAnswer}\n\nReasoning:\n${analysis.reasoning}`;
    } else {
       // Step 5: Student Solution Generation
       const studentModel = genAI.getGenerativeModel({ model: resolvedModelName });
       const studentPrompt = `You are an expert JEE/NEET faculty.
The student needs a premium solution for this question. The correct answer is ${resolvedCorrectAnswer}.
Here is the verified reasoning:
${analysis.reasoning}

Format a clean, premium solution following these strict rules:
1. Return EXACTLY three sections: **Approach:**, **Calculation:**, and **Final Answer:**. No introductory remarks.
2. In **Approach:**, clearly state the concept used (${analysis.concepts.join(', ')}) and the quick approach.
3. In **Calculation:**, provide the essential steps.
4. **Final Answer:** MUST be exactly ${resolvedCorrectAnswer}.

Return only the markdown text.`;

       const studentResult = await studentModel.generateContent(studentPrompt);
       solutionText = studentResult.response.text();
    }
    const durationMs = Date.now() - startTime;

    // Step 6: Reality Audit Storage
    const payload: any = {
      test_question_asset_id: assetId,
      question_id: examQuestionId,
      institute_id: job.institute_id,
      content_markdown: solutionText,
      is_active: validationPassed,
      generation_status: finalStatus,
      provider: "Google",
      model_name: resolvedModelName,
      generation_source: generationSource,
      generated_model: resolvedModelName,
      version: 1,
      prompt_version: PROMPT_VERSION,
      prompt_snapshot: promptSnapshot,
      generation_duration_ms: durationMs,
      generation_attempts: attempts,
      validation_passed: validationPassed,
      generated_at: new Date().toISOString(),
      
      // Phase 3 Architecture fields
      subject: analysis.subject,
      chapter: analysis.chapter,
      subchapter: analysis.subchapter,
      concepts: analysis.concepts,
      model_answer: analysis.model_answer,
      teacher_answer: resolvedCorrectAnswer,
      confidence: analysis.confidence,
      mismatch_reason: mismatchReason,
      ai_metadata: analysis
    };
    
    let existingSolId = null;
    const { data: existingQ } = await supabase.from("question_solutions").select("id").eq("question_id", examQuestionId).maybeSingle();
    if (existingQ) {
      existingSolId = existingQ.id;
    } else if (assetId) {
      const { data: existingA } = await supabase.from("question_solutions").select("id").eq("test_question_asset_id", assetId).maybeSingle();
      if (existingA) existingSolId = existingA.id;
    }

    if (existingSolId) {
      await supabase.from("question_solutions").update(payload).eq("id", existingSolId);
    } else {
      await supabase.from("question_solutions").insert(payload);
    }

    // 10. Clear Memory
    apiKey = "";

    // 11. Update Queue
    if (validationPassed) {
      await updateQueueState(job.id, "SUCCESS", null, null, "COMPLETED", attempts, null);
    } else {
      // Even if validation failed (mismatch), the queue job has technically completed its run
      // It stored the mismatch_reason in question_solutions. We do NOT want to endlessly retry.
      await updateQueueState(job.id, "VALIDATION", mismatchReason || "Validation failed", null, "COMPLETED", attempts, null);
    }

    return { 
      success: true, 
      processed: 1, 
      status: finalStatus, 
      validation_passed: validationPassed,
      attempts
    };

  } catch (error: any) {
    apiKey = ""; // Clear on failure
    console.error("Gemini worker failed:", error);
    
    // Parse error string to determine stage if possible
    const errMessage = error.message || String(error);
    let stage = "UNKNOWN";
    if (errMessage.includes("[GEMINI_CALL]")) stage = "GEMINI_CALL";
    else if (errMessage.includes("tenant") || errMessage.includes("decrypt")) stage = "KEY_RESOLUTION";
    
    // Calculate current attempt safely
    const currentAttempts = (job.attempts || 0) + 1;
    let nextStatus = "FAILED";
    let nextRetryAt: string | null = null;

    // We retry all execution errors except permanent ones (like missing keys) up to 3 times
    if (currentAttempts < 3 && !errMessage.includes("tenant") && !errMessage.includes("AI_KEY")) {
      nextStatus = "WAITING_RETRY";
      nextRetryAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    }

    await updateQueueState(job.id, stage, errMessage.replace("[GEMINI_CALL] ", ""), errMessage, nextStatus, currentAttempts, nextRetryAt);

    return { success: false, reason: error.message, nextStatus };
  }
}
