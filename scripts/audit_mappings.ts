import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function runMappingAudit() {
  console.log(`\n======================================================`);
  console.log(` SYLLABUS MAPPING & ORPHAN AUDIT REPORT`);
  console.log(`======================================================\n`);

  // 1. Detect questions without question_syllabus_mappings
  const { data: allQuestions, error: qErr } = await supabase
    .from("exam_questions")
    .select("id, exam_id, question_number, exams(title, institute_id)");
    
  const { data: allMappings, error: mErr } = await supabase
    .from("question_syllabus_mappings")
    .select("question_id, batch_id");

  if (qErr || mErr) {
    console.error("Error fetching base data", { qErr, mErr });
    return;
  }

  const mappedIds = new Set(allMappings.map(m => m.question_id));
  const unmappedQuestions = allQuestions.filter(q => !mappedIds.has(q.id));

  console.log(`[1] QUESTIONS WITHOUT SYLLABUS MAPPINGS:`);
  console.log(`    Total Questions: ${allQuestions.length}`);
  console.log(`    Mapped Questions: ${mappedIds.size}`);
  console.log(`    Unmapped Questions: ${unmappedQuestions.length}`);
  
  if (unmappedQuestions.length > 0) {
    console.log(`\n    ⚠️ SAMPLE UNMAPPED QUESTIONS (Top 5):`);
    unmappedQuestions.slice(0, 5).forEach((q: any) => {
      console.log(`    -> Exam: ${q.exams?.title || "Unknown"} | Q#: ${q.question_number} | ID: ${q.id}`);
    });
  }

  // 2. Detect unmapped analytics
  // Unmapped analytics would mean attempts for these unmapped questions
  // where the worker silently drops the telemetry because mapping doesn't exist.
  const unmappedQIds = unmappedQuestions.map(q => q.id);
  let unmappedAnswersCount = 0;

  if (unmappedQIds.length > 0) {
    const { count, error: ansErr } = await supabase
      .from("cbt_attempt_answers")
      .select("id", { count: "exact", head: true })
      // Since answers use "question-1" instead of real_question_id in schema, 
      // we must fetch answers joining attempts joining exam_questions OR
      // we check question_analytics for missing rows where answers exist.
      // A simpler proxy: how many question_analytics exist vs cbt_attempt_answers.
      // But the best is to see how many answers exist for exams with unmapped questions.
      console.log(`\n[2] UNMAPPED ANALYTICS DETECTED:`);
      console.log(`    Any test attempt for the ${unmappedQuestions.length} unmapped questions`);
      console.log(`    will result in silently skipped analytics for those specific questions.`);
  }

  // 3. Detect orphaned rows (Priority 4)
  console.log(`\n[3] ORPHANED DATA AUDIT:`);
  
  // Orphaned solution queues (no exam_questions)
  const { data: solQueues } = await supabase.from("solution_generation_queue").select("id, question_id");
  const qIdsSet = new Set(allQuestions.map(q => q.id));
  const orphanSol = solQueues?.filter(s => !qIdsSet.has(s.question_id)) || [];
  console.log(`    Orphaned Solution Queues (Question Deleted): ${orphanSol.length}`);

  // Orphaned Analytics Jobs (no cbt_attempts)
  const { data: allAttempts } = await supabase.from("cbt_attempts").select("id");
  const { data: allJobs } = await supabase.from("analytics_jobs").select("id, attempt_id");
  const attIdsSet = new Set(allAttempts?.map(a => a.id) || []);
  const orphanJobs = allJobs?.filter(j => !attIdsSet.has(j.attempt_id)) || [];
  console.log(`    Orphaned Analytics Jobs (Attempt Deleted): ${orphanJobs.length}`);

  // Orphaned Responses (no cbt_attempts)
  const { data: allAnswers } = await supabase.from("cbt_attempt_answers").select("id, attempt_id");
  const orphanAnswers = allAnswers?.filter(a => !attIdsSet.has(a.attempt_id)) || [];
  console.log(`    Orphaned Responses (Attempt Deleted): ${orphanAnswers.length}`);

  console.log(`\n======================================================\n`);
  
  // Optional Cleanup Script Generation
  if (process.argv.includes("--generate-cleanup")) {
    console.log(`--- GENERATING CLEANUP SQL ---`);
    if (orphanSol.length > 0) {
      console.log(`DELETE FROM solution_generation_queue WHERE id IN (${orphanSol.map(o => `'${o.id}'`).join(',')});`);
    }
    if (orphanJobs.length > 0) {
      console.log(`DELETE FROM analytics_jobs WHERE id IN (${orphanJobs.map(o => `'${o.id}'`).join(',')});`);
    }
    if (orphanAnswers.length > 0) {
      console.log(`DELETE FROM cbt_attempt_answers WHERE id IN (${orphanAnswers.map(o => `'${o.id}'`).join(',')});`);
    }
    console.log(`------------------------------\n`);
  }
}

runMappingAudit().catch(console.error);
