import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { LeasedJob, markJobComplete, markJobFailed } from "./queue";
import { GeminiProvider } from "../ai/providers/gemini-provider";
import type { SolutionProviderResult } from "../ai/providers/provider";

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

    // 3. Check exact prompt + provider idempotency
    const provider = new GeminiProvider();
    let promptVersion = "solution-v1";
    
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

    // Validation Layer
    const normalize = (s: string) => s.toLowerCase().trim();
    if (!result.finalAnswer) {
      throw new Error("Validation Failed: Final Answer missing.");
    }
    let detectedStatus = "pending";

    if (correctAnswer && normalize(result.finalAnswer) !== normalize(correctAnswer)) {
      // Check if correctAnswer is of form "A: A" and result is "A"
      const parts = correctAnswer.split(":");
      const firstPart = parts[0].trim();
      const lastPart = parts.length > 1 ? parts.slice(1).join(":").trim() : firstPart;

      if (normalize(result.finalAnswer) !== normalize(firstPart) && normalize(result.finalAnswer) !== normalize(lastPart)) {
        detectedStatus = "DISPUTED";
        console.log(`\n============================`);
        console.log(`WRONG KEY DETECTION TRIGGERED`);
        console.log(`Question Number: ${eqData?.question_number || "Unknown"}`);
        console.log(`Teacher Key: ${correctAnswer}`);
        console.log(`Model Answer: ${result.finalAnswer}`);
        console.log(`Confidence: Unknown (Using existing schema)`);
        console.log(`Reasoning: Model final answer mismatched teacher key.`);
        console.log(`Detected Status: DISPUTED`);
        console.log(`============================\n`);

        await supabase.from("solution_generation_events").insert([
          { queue_id: job.id, institute_id: job.institute_id, event_type: "answer_key_mismatch", metadata: { teacher_key: correctAnswer, model_answer: result.finalAnswer } }
        ]);
        // DO NOT throw error. Let the solution be stored.
      }
    }

    const meta = result.aiMetadata;
    const validation = { passed: true, reason: null };
    if (!meta.subject) throw new Error("Validation Failed: Subject missing.");
    if (!meta.topic) throw new Error("Validation Failed: Topic missing.");
    if (!meta.difficulty) throw new Error("Validation Failed: Difficulty missing.");
    if (!meta.question_type) throw new Error("Validation Failed: Question Type missing.");
    if (!meta.primary_concept) throw new Error("Validation Failed: Primary Concept missing.");
    if (!meta.essential_steps || meta.essential_steps.length === 0) {
      throw new Error("Validation Failed: Essential Steps missing.");
    }

    const allText = JSON.stringify(meta);
    if (/as an ai|here is|certainly|let me|this means|so,/i.test(allText)) {
      throw new Error("Validation Failed: Conversational filler detected.");
    }
    if (/in the image|this image shows|the provided image/i.test(allText)) {
      throw new Error("Validation Failed: Image-description filler detected.");
    }

    const wordCount = allText.split(/\s+/).length;
    if (wordCount > 150) {
      throw new Error(`Validation Failed: Total output exceeds 150 words (${wordCount} words).`);
    }

    await supabase.from("solution_generation_events").insert({ queue_id: job.id, institute_id: job.institute_id, event_type: "validation_passed" });

    // 5. Store the result
    const { count, error: countErr } = await supabase
      .from("question_solutions")
      .select("*", { count: "exact", head: true })
      .eq("question_id", job.question_id);
      
    const versionNumber = (count || 0) + 1;

    const { error: insertErr } = await supabase
      .from("question_solutions")
      .insert({
        question_id: job.question_id,
        institute_id: job.institute_id,
        version: versionNumber,
        is_active: versionNumber === 1, // Auto-activate the first version generated
        content_markdown: result.markdownSolution,
        final_answer: result.finalAnswer,
        answer_confidence: result.answerConfidence,
        provider: provider.name,
        model_name: provider.modelName,
        prompt_version: result.promptVersion,
        token_usage: result.tokenUsage,
        generation_status: "COMPLETED",
        review_status: detectedStatus,
        ai_metadata: { ...result.aiMetadata, validation_status: "PASSED" },
        created_by: "system"
      });

    if (insertErr) {
      throw new Error(`Failed to insert solution: ${insertErr.message}`);
    }

    // 6. Mark job complete
    await markJobComplete(job.id, job.institute_id);
    console.log(`Successfully processed job ${job.id} for question ${job.question_id}`);

  } catch (error: any) {
    console.error(`Job ${job.id} failed:`, error.message);
    await markJobFailed(job.id, job.institute_id, error.message, job.attempts);
  }
}
