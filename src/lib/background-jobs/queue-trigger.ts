import { createClient } from "@supabase/supabase-js";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Enqueue all unpublished questions for an exam and immediately begin
 * generating solutions sequentially in the background.
 *
 * The sequential loop respects Gemini's free-tier 15 RPM limit by
 * inserting a 4500ms delay between every question (= ~8 questions/min
 * for 2 calls/question, safely under 15 RPM).
 *
 * For a 75-question JEE paper:
 *   75 questions × 4.5s delay ≈ 5.6 minutes of continuous generation
 *   This is typically complete before the 3-hour exam ends.
 */
export async function enqueueSolutionsForExam(
  examId: string,
  instituteId: string,
): Promise<{ enqueued: number; skipped: number }> {
  // 1. Fetch all question IDs for this exam
  const { data: questions, error: questionsError } = await supabase
    .from("exam_questions")
    .select("id")
    .eq("exam_id", examId);

  if (questionsError || !questions) {
    throw new Error(`Failed to fetch exam questions for exam ${examId}`);
  }

  if (questions.length === 0) {
    return { enqueued: 0, skipped: 0 };
  }

  // 2. Fetch optional asset mappings
  const { data: assets } = await supabase
    .from("test_question_assets")
    .select("id, exam_question_id")
    .eq("exam_id", examId);

  const assetMap = new Map<string, string>();
  if (assets) {
    assets.forEach((a) => assetMap.set(a.exam_question_id, a.id));
  }

  // 3. Exclude questions already queued (UNIQUE constraint also prevents duplicates)
  const questionIds = questions.map((q) => q.id);
  const { data: existingQueue } = await supabase
    .from("solution_generation_queue")
    .select("question_id")
    .in("question_id", questionIds);

  const existingSet = new Set((existingQueue ?? []).map((q) => q.question_id));

  const newItems = questions
    .filter((q) => !existingSet.has(q.id))
    .map((q) => ({
      institute_id: instituteId,
      question_id: q.id,
      test_question_asset_id: assetMap.get(q.id) ?? null,
      status: "PENDING",
      priority: 100,
    }));

  if (newItems.length === 0) {
    return { enqueued: 0, skipped: questions.length };
  }

  // 4. Insert queue rows
  const { error: insertError } = await supabase
    .from("solution_generation_queue")
    .insert(newItems);

  if (insertError) {
    // If the UNIQUE constraint fires (double-click / retry), it's safe to ignore
    if (insertError.code === "23505") {
      console.log("[queue-trigger] Duplicate enqueue blocked by UNIQUE constraint — safe to ignore");
      return { enqueued: 0, skipped: questions.length };
    }
    throw new Error(`Failed to enqueue solutions: ${insertError.message}`);
  }

  // Note: Background worker is no longer triggered here (fire-and-forget removed).
  // It is processed by a distributed cron orchestrator.

  return { enqueued: newItems.length, skipped: existingSet.size };
}
