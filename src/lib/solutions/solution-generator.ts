import { createServiceRoleClient, getInstituteGeminiKey } from "@/lib/institute/get-institute-api-key";
import { LeasedJob, markJobComplete, markJobFailed } from "./queue";
import { GeminiProvider } from "../ai/providers/gemini-provider";
import type { SolutionProviderResult } from "../ai/providers/provider";
import { postProcessSolution } from "./post-processing";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Combined Word Budgets (Exam + Learn) ──────────────────────────────────
const WORD_LIMITS: Record<string, number> = {
  Easy: 260,   // Exam ≤50 + Learn ≤180 + headroom
  Medium: 420, // Exam ≤80 + Learn ≤300 + headroom
  Hard: 580,   // Exam ≤120 + Learn ≤420 + headroom
};

// ─── Compression Prompt ─────────────────────────────────────────────────────
const COMPRESSION_PROMPT = `You are a solution editor. Your job is to compress the following JSON solution.

Rules:
1. Remove every sentence that does not increase understanding.
2. examMode.fastSteps: Each step must be ≤2 lines. Remove narration. Keep only equations and key reasoning.
3. learnMode: Keep the insight. Remove padding words. Never add new content.
4. Do NOT change the answer, concepts, equations, or structure.
5. Do NOT add new fields or remove required fields.
6. Return the exact same JSON structure, just compressed.

Input JSON:
`;

/**
 * Run a compression pass on the generated solution using the same model.
 * This removes padding, narration, and unnecessary sentences.
 */
async function compressSolution(
  rawMeta: any,
  instituteId: string
): Promise<any> {
  try {
    const apiKey = await getInstituteGeminiKey(instituteId);
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite",
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    // Only send the parts that need compression
    const toCompress = {
      examMode: rawMeta.examMode,
      learnMode: rawMeta.learnMode,
      finalAnswer: rawMeta.finalAnswer,
    };

    const prompt = COMPRESSION_PROMPT + JSON.stringify(toCompress, null, 2);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const compressed = JSON.parse(text);

    // Merge compressed content back, keeping all metadata intact
    return {
      ...rawMeta,
      examMode: compressed.examMode || rawMeta.examMode,
      learnMode: compressed.learnMode || rawMeta.learnMode,
      // Don't override finalAnswer from compression — keep the original
    };
  } catch (err: any) {
    console.warn("Compression pass failed, using uncompressed output:", err.message);
    return rawMeta; // Graceful fallback — use uncompressed
  }
}

export async function processLeasedJob(job: LeasedJob) {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Supabase client unavailable");

  try {
    // 1. Check idempotency: strictly skip generation if active solution exists (Constraint 2)
    const { data: existingActive, error: activeErr } = await supabase
      .from("question_solutions")
      .select("id")
      .eq("question_id", job.question_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!activeErr && existingActive) {
      console.log(`Skipping job ${job.id}: Active solution already exists for question ${job.question_id}`);
      await markJobComplete(job.id, job.institute_id);
      return;
    }

    // 2. Fetch question data and structured content
    let rawText = "";
    let options = [];
    let correctAnswer = "";

    let extractedSubject = "";
    let extractedChapter = "";
    let imageUrl = "";
    let questionType = "";

    // Try exam_questions first
    const { data: eqData, error: eqErr } = await supabase.from("exam_questions").select("*").eq("id", job.question_id).maybeSingle();
    
    if (eqData) {
      rawText = eqData.published_question_text || "";
      options = eqData.published_options || [];
      correctAnswer = eqData.published_answer_key || "";
      questionType = eqData.question_type || "";
      imageUrl = eqData.published_image_url || "";
      
      if (!imageUrl && Array.isArray(options)) {
        const metaOpt = options.find((o: any) => o.id === "__metadata__");
        if (metaOpt && metaOpt.text) {
          try {
             const parsed = JSON.parse(metaOpt.text);
             if (parsed.stemImage) {
                imageUrl = parsed.stemImage;
             }
          } catch(e) {}
        }
      }
    } else {
      const { data: questionData, error: qErr } = await supabase
        .from("questions")
        .select("*, question_content(*)")
        .eq("id", job.question_id)
        .single();

      if (qErr || !questionData) {
        throw new Error(`Failed to fetch question ${job.question_id}: ${qErr?.message}`);
      }
      const contentData = Array.isArray(questionData.question_content) ? questionData.question_content[0] : questionData.question_content;
      const content = contentData || {};
      rawText = content.raw_text || questionData.question_text || "";
      options = content.structured_options || questionData.options || [];
      correctAnswer = content.correct_answer || questionData.correct_answer || "";
      extractedSubject = content.extracted_subject || questionData.subject || "";
      extractedChapter = content.extracted_chapter || questionData.chapter || "";
      questionType = questionData.question_type || "";
      imageUrl = content.image_url || questionData.image_url || "";
    }

    // Snapshot Validation
    if (!job.question_id) {
       throw new Error("Snapshot Validation Failed: missing question_id");
    }
    if (!imageUrl) {
       throw new Error("Snapshot Validation Failed: missing image");
    }
    if (!correctAnswer) {
       throw new Error("Snapshot Validation Failed: missing teacher key");
    }

    const providerInput = {
      questionId: job.question_id,
      instituteId: job.institute_id,
      rawText,
      structuredOptions: options,
      correctAnswer,
      extractedSubject,
      extractedChapter,
      imageUrl,
      questionType
    };

    // 3. Check exact prompt + provider idempotency — V3 is the canonical prompt
    const provider = new GeminiProvider();
    const promptVersion = "solution-v3";
    
    const { data: existingSameVersion, error: exactErr } = await supabase
      .from("question_solutions")
      .select("id")
      .eq("question_id", job.question_id)
      .eq("provider", provider.name)
      .eq("prompt_version", promptVersion)
      .maybeSingle();

    if (!exactErr && existingSameVersion) {
      console.log(`Skipping job ${job.id}: Solution already generated for ${provider.name} with ${promptVersion}`);
      await markJobComplete(job.id, job.institute_id);
      return;
    }

    // 4. Generate the solution via provider
    let result: SolutionProviderResult = await provider.generateSolution(providerInput, promptVersion);

    // ─── Answer Key Validation ──────────────────────────────────────────────
    const normalize = (s: string) => s.toLowerCase().trim();
    if (!result.finalAnswer) {
      throw new Error("Validation Failed: Final Answer missing.");
    }
    let detectedStatus = "pending";

    if (correctAnswer && normalize(result.finalAnswer) !== normalize(correctAnswer)) {
      const parts = correctAnswer.split(":");
      const firstPart = parts[0].trim();
      const lastPart = parts.length > 1 ? parts.slice(1).join(":").trim() : firstPart;

      if (normalize(result.finalAnswer) !== normalize(firstPart) && normalize(result.finalAnswer) !== normalize(lastPart)) {
        detectedStatus = "pending";
        console.log(`\n============================`);
        console.log(`WRONG KEY DETECTION TRIGGERED`);
        console.log(`Question Number: ${eqData?.question_number || "Unknown"}`);
        console.log(`Teacher Key: ${correctAnswer}`);
        console.log(`Model Answer: ${result.finalAnswer}`);
        console.log(`Detected Status: DISPUTED (saved as pending)`);
        console.log(`============================\n`);

        await supabase.from("solution_generation_events").insert([
          { queue_id: job.id, institute_id: job.institute_id, event_type: "answer_key_mismatch", metadata: { teacher_key: correctAnswer, model_answer: result.finalAnswer } }
        ]);
      }
    }

    // ─── V3 Structural Validation ───────────────────────────────────────────
    const meta = result.aiMetadata as any;

    if (!meta.subject) throw new Error("Validation Failed: Subject missing.");
    if (!meta.topic) throw new Error("Validation Failed: Topic missing.");
    if (!meta.difficulty) throw new Error("Validation Failed: Difficulty missing.");
    if (!meta.primaryConcept && !meta.primary_concept) throw new Error("Validation Failed: Primary Concept missing.");
    if (!meta.learnMode?.keyIdea && !meta.essential_steps) throw new Error("Validation Failed: Key Idea / Essential Steps missing.");
    if (!meta.learnMode?.steps || meta.learnMode.steps.length === 0) {
      if (!meta.essential_steps || meta.essential_steps.length === 0) {
        throw new Error("Validation Failed: Steps missing.");
      }
    }

    // ─── Filler Detection ───────────────────────────────────────────────────
    const allText = JSON.stringify(meta);
    if (/as an ai|certainly|let me help/i.test(allText)) {
      throw new Error("Validation Failed: Conversational filler detected.");
    }
    if (/in the image|this image shows|the provided image/i.test(allText)) {
      throw new Error("Validation Failed: Image-description filler detected.");
    }

    // ─── Adaptive Word Budget ───────────────────────────────────────────────
    const difficulty = meta.difficulty || "Medium";
    const maxWords = WORD_LIMITS[difficulty] || WORD_LIMITS.Medium;
    const wordCount = allText.split(/\s+/).length;
    if (wordCount > maxWords * 1.5) {
      // Hard fail only if way over budget (1.5x). Post-processor handles soft budget.
      throw new Error(`Validation Failed: Total output exceeds ${maxWords * 1.5} words (${wordCount} words) for ${difficulty} difficulty.`);
    }

    await supabase.from("solution_generation_events").insert({ queue_id: job.id, institute_id: job.institute_id, event_type: "validation_passed" });

    // ─── 5. Compression Pass ────────────────────────────────────────────────
    // Generate → Compress → Validate → Store
    console.log(`Running compression pass for job ${job.id}...`);
    const compressedMeta = await compressSolution(meta, job.institute_id);

    // Rate limit: wait after compression call
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ─── 6. Post-Processing Pipeline ────────────────────────────────────────
    // Deduplicate → Remove filler → Semantic Check → Score quality
    const postProcessed = postProcessSolution(compressedMeta);
    const processedMeta = {
      ...postProcessed.solution,
      validation_status: "PASSED",
    };

    if (postProcessed.fillerRemoved) {
      console.log(`Post-processing: Filler removed for job ${job.id}`);
    }
    if (postProcessed.examViolations.length > 0) {
      console.log(`Post-processing: Exam violations for job ${job.id}:`, postProcessed.examViolations);
    }
    if (postProcessed.learnViolations.length > 0) {
      console.log(`Post-processing: Learn violations for job ${job.id}:`, postProcessed.learnViolations);
    }

    const qualityScore = postProcessed.qualityScore;
    console.log(`Quality Score: ${qualityScore.finalScore}/10 (clarity:${qualityScore.clarity} pedagogy:${qualityScore.pedagogy} conciseness:${qualityScore.conciseness} repetition:${qualityScore.repetition} notation:${qualityScore.notationConsistency})`);

    // Auto-regeneration: if score < 8 and we haven't already retried
    if (postProcessed.shouldRegenerate && job.attempts < 2) {
      console.log(`Quality score ${qualityScore.finalScore} < 8. Flagging for regeneration (attempt ${job.attempts + 1}).`);
      await supabase.from("solution_generation_events").insert({
        queue_id: job.id,
        institute_id: job.institute_id,
        event_type: "quality_below_threshold",
        metadata: {
          qualityScore,
          attempt: job.attempts,
          examViolations: postProcessed.examViolations,
          learnViolations: postProcessed.learnViolations,
        }
      });
      // Mark as failed to trigger retry with exponential backoff
      await markJobFailed(job.id, job.institute_id, `Quality score ${qualityScore.finalScore} below threshold 8`, job.attempts);
      return;
    }

    // ─── 7. Store the result ────────────────────────────────────────────────
    const { count, error: countErr } = await supabase
      .from("question_solutions")
      .select("*", { count: "exact", head: true })
      .eq("question_id", job.question_id);
      
    const versionNumber = (count || 0) + 1;

    // Deactivate previous versions
    if (versionNumber > 1) {
      await supabase
        .from("question_solutions")
        .update({ is_active: false })
        .eq("question_id", job.question_id);
    }

    const { error: insertErr } = await supabase
      .from("question_solutions")
      .insert({
        question_id: job.question_id,
        institute_id: job.institute_id,
        version: versionNumber,
        is_active: true,
        content_markdown: result.markdownSolution,
        final_answer: result.finalAnswer,
        answer_confidence: result.answerConfidence,
        provider: provider.name,
        model_name: provider.modelName,
        prompt_version: result.promptVersion,
        token_usage: result.tokenUsage,
        generation_status: "COMPLETED",
        review_status: detectedStatus,
        ai_metadata: processedMeta,
        created_by: "system"
      });

    if (insertErr) {
      throw new Error(`Failed to insert solution: ${insertErr.message}`);
    }

    // 8. Mark job complete
    await markJobComplete(job.id, job.institute_id);
    console.log(`Successfully processed job ${job.id} for question ${job.question_id} (quality: ${qualityScore.finalScore}/10)`);

  } catch (error: any) {
    console.error(`Job ${job.id} failed:`, error.message);
    await markJobFailed(job.id, job.institute_id, error.message, job.attempts);
  }
}
