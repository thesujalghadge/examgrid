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
    const { data: questionData, error: qErr } = await supabase
      .from("questions")
      .select("*, question_content(*)")
      .eq("id", job.question_id)
      .single();

    if (qErr || !questionData) {
      throw new Error(`Failed to fetch question ${job.question_id}: ${qErr?.message}`);
    }

    // Prepare inputs
    const contentData = Array.isArray(questionData.question_content) ? questionData.question_content[0] : questionData.question_content;
    const content = contentData || {};
    const rawText = content.raw_text || questionData.question_text || "";
    const options = content.structured_options || questionData.options || [];
    const correctAnswer = content.correct_answer || questionData.correct_answer || "";

    const providerInput = {
      questionId: job.question_id,
      instituteId: job.institute_id,
      rawText,
      structuredOptions: options,
      correctAnswer,
      extractedSubject: content.extracted_subject || questionData.subject,
      extractedChapter: content.extracted_chapter || questionData.chapter,
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
    if (correctAnswer) {
      const match = result.finalAnswer && normalize(result.finalAnswer) === normalize(correctAnswer);
      if (!match) {
        // First validation failed
        await supabase.from("solution_generation_events").insert([
          { queue_id: job.id, institute_id: job.institute_id, event_type: "validation_failed" },
          { queue_id: job.id, institute_id: job.institute_id, event_type: "answer_key_mismatch" }
        ]);

        console.log(`Answer mismatch for job ${job.id}. Expected: ${correctAnswer}, Got: ${result.finalAnswer}. Retrying with strict prompt...`);
        
        promptVersion = "solution-v2-strict";
        result = await provider.generateSolution(providerInput, promptVersion);

        const secondaryMatch = result.finalAnswer && normalize(result.finalAnswer) === normalize(correctAnswer);
        if (!secondaryMatch) {
          console.log(`Mismatch persisted for job ${job.id}. Flagging for review.`);
          result.answerConfidence = 0.1;
        } else {
          await supabase.from("solution_generation_events").insert({ queue_id: job.id, institute_id: job.institute_id, event_type: "validation_passed" });
        }
      } else {
        await supabase.from("solution_generation_events").insert({ queue_id: job.id, institute_id: job.institute_id, event_type: "validation_passed" });
      }
    }

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
        generation_status: "completed",
        review_status: "pending",
        ai_metadata: result.aiMetadata,
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
