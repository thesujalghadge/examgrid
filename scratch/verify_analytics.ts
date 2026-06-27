import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== DB SCHEMA DIAGNOSTICS ===");
  const { data: att } = await supabase.from('cbt_attempts').select('id, student_roll_number, student_id').limit(1);
  console.log("cbt_attempts:", att);

  const { data: res } = await supabase.from('cbt_results').select('*').limit(1);
  console.log("cbt_results:", res);

  const { data: analytics } = await supabase.from('student_exam_subject_analytics').select('*').limit(1);
  console.log("student_exam_subject_analytics:", analytics);

  console.log("\n=== FULL ANALYTICS VERIFICATION ===");
  
  // Pick a single attempted exam that has analytics_jobs
  const { data: jobs } = await supabase.from('analytics_jobs').select('*').limit(1);
  if (!jobs || jobs.length === 0) {
    console.log("No analytics_jobs found. Generating test submission...");
    return;
  }
  const job = jobs[0];
  const examId = job.exam_id;
  const studentId = job.student_id;
  const attemptId = job.attempt_id;
  
  console.log(`Verifying for Student: ${studentId}, Exam: ${examId}, Attempt: ${attemptId}\n`);

  const tables = [
    { name: 'analytics_jobs', q: supabase.from('analytics_jobs').select('*').eq('id', job.id) },
    { name: 'student_exam_subject_analytics', q: supabase.from('student_exam_subject_analytics').select('*').eq('exam_id', examId).eq('student_id', studentId) },
    { name: 'student_exam_chapter_analytics', q: supabase.from('student_exam_chapter_analytics').select('*').eq('exam_id', examId).eq('student_id', studentId) },
    { name: 'student_exam_concept_analytics', q: supabase.from('student_exam_concept_analytics').select('*').eq('exam_id', examId).eq('student_id', studentId) },
    { name: 'student_cumulative_subject_analytics', q: supabase.from('student_cumulative_subject_analytics').select('*').eq('student_id', studentId) },
    { name: 'student_cumulative_chapter_analytics', q: supabase.from('student_cumulative_chapter_analytics').select('*').eq('student_id', studentId) },
    { name: 'student_cumulative_concept_analytics', q: supabase.from('student_cumulative_concept_analytics').select('*').eq('student_id', studentId) },
    { name: 'student_recommendations', q: supabase.from('student_recommendations').select('*').eq('exam_id', examId).eq('student_id', studentId) },
    { name: 'analytics_snapshots', q: supabase.from('analytics_snapshots').select('*').eq('exam_id', examId).eq('student_id', studentId) },
    { name: 'question_analytics', q: supabase.from('question_analytics').select('*').eq('exam_id', examId) },
  ];

  console.log("Table | Row Count | Example Row | PASS/FAIL");
  console.log("--------------------------------------------------");

  for (const t of tables) {
    const { data, error } = await t.q;
    if (error) {
      console.log(`${t.name} | ERROR | - | FAIL`);
    } else {
      const count = data?.length || 0;
      const ex = count > 0 ? JSON.stringify(data[0]).substring(0, 50) + "..." : "None";
      const pass = count > 0 ? "PASS" : "FAIL";
      console.log(`${t.name} | ${count} | ${ex} | ${pass}`);
    }
  }

  console.log("\n--- Checking Telemetry in cbt_attempt_answers ---");
  const { data: answers } = await supabase.from('cbt_attempt_answers').select('time_taken_seconds, first_answer, answer_changed_count, marked_for_review, visited_count').eq('attempt_id', attemptId).limit(5);
  
  if (answers && answers.length > 0) {
    console.log("Telemetry check PASS: ", JSON.stringify(answers[0]));
  } else {
    console.log("Telemetry check FAIL: No answers or fields missing.");
  }
}

run().catch(console.error);
