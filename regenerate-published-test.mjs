/**
 * Regeneration Script for Published Test
 * 
 * Deactivates existing solutions → Clears queue → Re-enqueues → Runs worker
 * 
 * Usage: node regenerate-published-test.mjs
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  ExamGrid Solution Regeneration — V3.1 Prompt");
  console.log("═══════════════════════════════════════════════════\n");

  // 1. Find ALL published exams
  const { data: publishedExams, error: examErr } = await supabase
    .from("exams")
    .select("id, title, institute_id")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (examErr || !publishedExams || publishedExams.length === 0) {
    console.error("No published exams found:", examErr?.message);
    process.exit(1);
  }

  console.log(`Found ${publishedExams.length} published exams`);

  // 2. Find all published questions across all exams
  const allExamIds = publishedExams.map(e => e.id);
  const { data: questions, error: qErr } = await supabase
    .from("exam_questions")
    .select("id, question_number, exam_id")
    .in("exam_id", allExamIds)
    .not("published_question_text", "is", null)
    .order("question_number");

  if (qErr || !questions || questions.length === 0) {
    console.error("No published questions found:", qErr?.message);
    process.exit(1);
  }

  const instituteId = publishedExams[0].institute_id;
  const questionIds = questions.map(q => q.id);
  console.log(`Found ${questionIds.length} published questions across all exams\n`);

  // 3. Snapshot existing solutions for comparison
  const { data: existingSolutions } = await supabase
    .from("question_solutions")
    .select("question_id, ai_metadata")
    .in("question_id", questionIds)
    .eq("is_active", true);

  const oldSolutionCount = existingSolutions?.length || 0;
  console.log(`Existing active solutions: ${oldSolutionCount}`);

  // 4. Deactivate existing solutions
  if (oldSolutionCount > 0) {
    const { error: deactivateErr } = await supabase
      .from("question_solutions")
      .update({ is_active: false })
      .in("question_id", questionIds);

    if (deactivateErr) {
      console.error("Failed to deactivate solutions:", deactivateErr.message);
      process.exit(1);
    }
    console.log(`✓ Deactivated ${oldSolutionCount} existing solutions`);
  }

  // 5. Clear queue for these questions
  const { error: clearErr } = await supabase
    .from("solution_generation_queue")
    .delete()
    .in("question_id", questionIds);

  if (clearErr) {
    console.warn("Queue clear warning:", clearErr.message);
  } else {
    console.log("✓ Cleared queue entries");
  }

  // 6. Re-enqueue all questions
  const queueInserts = questionIds.map(qId => ({
    question_id: qId,
    institute_id: instituteId,
    priority: 100,
    status: "PENDING",
  }));

  const { data: enqueued, error: enqueueErr } = await supabase
    .from("solution_generation_queue")
    .insert(queueInserts)
    .select("id");

  if (enqueueErr) {
    console.error("Failed to enqueue:", enqueueErr.message);
    process.exit(1);
  }

  console.log(`✓ Enqueued ${enqueued?.length || 0} questions for regeneration\n`);

  // 7. Insert audit events
  if (enqueued && enqueued.length > 0) {
    const events = enqueued.map(q => ({
      queue_id: q.id,
      institute_id: instituteId,
      event_type: "queued",
      metadata: { reason: "v3.1-prompt-redesign" }
    }));
    await supabase.from("solution_generation_events").insert(events);
  }

  console.log("═══════════════════════════════════════════════════");
  console.log("  Regeneration queued successfully!");
  console.log("");
  console.log("  Next steps:");
  console.log("  1. Run the worker: npx tsx src/workers/solution-worker.ts");
  console.log("  2. Monitor quality scores in the console output");
  console.log("  3. Compare solutions in the student UI");
  console.log("═══════════════════════════════════════════════════");
}

run().catch(err => {
  console.error("Regeneration failed:", err);
  process.exit(1);
});
