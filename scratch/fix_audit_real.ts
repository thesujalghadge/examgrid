import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const realExamId = "d7ebe9de-e61a-4956-bf04-871a65139f41";
  const examId = "cbt-" + realExamId + "-paper-1781874180816";
  const studentId = "b806291f-f4cf-46c0-8c55-4f3f0fe4e6ed";
  const attemptId = "63ef3d64-e982-44d9-8ddd-23976b2eb3ab";
  const questionId = "a09243c5-77da-490f-8adb-3a2c66439ce7"; // The real question UUID
  const batchId = "55555555-5555-5555-5555-555555555555";
  const mockSubjectId = "a1111111-1111-1111-1111-111111111111";
  const mockChapterId = "b1111111-1111-1111-1111-111111111111";
  const mockConceptId = "c1111111-1111-1111-1111-111111111111";

  // Clean old rows
  await supabase.from('cbt_attempts').delete().eq('id', attemptId);

  // Insert mock batch
  await supabase.from('batches').upsert({
    id: batchId, institute_id: '00000000-0000-0000-0000-000000000001', name: "Mock Batch", academic_year: "2026-2027", course_type: "JEE"
  });

  // Mappings
  const { error: nodeErr } = await supabase.from('batch_syllabus_nodes').upsert([
    { id: mockSubjectId, name: 'Mock Subject', node_type: 'SUBJECT', parent_id: null, batch_id: batchId, institute_id: '00000000-0000-0000-0000-000000000001' },
    { id: mockChapterId, name: 'Mock Chapter', node_type: 'CHAPTER', parent_id: mockSubjectId, batch_id: batchId, institute_id: '00000000-0000-0000-0000-000000000001' },
    { id: mockConceptId, name: 'Mock Concept', node_type: 'TOPIC', parent_id: mockChapterId, batch_id: batchId, institute_id: '00000000-0000-0000-0000-000000000001' }
  ]);
  if (nodeErr) console.error("Nodes Error:", nodeErr);

  const { error: mapErr } = await supabase.from('question_syllabus_mappings').upsert({
    question_id: questionId, batch_id: batchId, institute_id: '00000000-0000-0000-0000-000000000001',
    syllabus_subject_id: mockSubjectId, syllabus_chapter_id: mockChapterId, syllabus_topic_id: mockConceptId,
    mapping_method: "MANUAL_CORRECTION"
  });
  if (mapErr) console.error("Mapping Error:", mapErr);

  const { error: cbtErr } = await supabase.from('cbt_attempts').upsert({
    id: attemptId, test_id: examId, student_id: studentId, institute_id: '00000000-0000-0000-0000-000000000001',
    student_roll_number: "STUDENT001", status: "submitted", session_id: "test-sess", total_questions: 1, attempted_questions: 1,
    score: 4,
    started_at: new Date().toISOString(), submitted_at: new Date().toISOString()
  });
  if (cbtErr) console.error("cbt_attempts Error:", cbtErr);

  const { error: ansErr } = await supabase.from('cbt_attempt_answers').upsert({
    attempt_id: attemptId, question_id: "question-1", is_correct: true, marks_awarded: 4,
    selected_answer: "B", time_taken_seconds: 45, first_answer: "B", answer_changed_count: 0,
    marked_for_review: false, visited_count: 1
  });
  if (ansErr) console.error("cbt_attempt_answers Error:", ansErr);

  const { error: jobErr } = await supabase.from('analytics_jobs').upsert({
    id: attemptId, attempt_id: attemptId, student_id: studentId, exam_id: examId, batch_id: batchId, status: "PENDING"
  });
  if (jobErr) console.error("analytics_jobs Error:", jobErr);

  console.log("Running worker...");
  const { runAnalyticsWorker } = await import("../src/lib/analytics/worker");
  await runAnalyticsWorker();

  const tables = [
    { name: 'analytics_jobs', q: supabase.from('analytics_jobs').select('*').eq('attempt_id', attemptId) },
    { name: 'student_exam_subject_analytics', q: supabase.from('student_exam_subject_analytics').select('*').eq('exam_id', realExamId).eq('student_id', studentId) },
    { name: 'student_exam_chapter_analytics', q: supabase.from('student_exam_chapter_analytics').select('*').eq('exam_id', realExamId).eq('student_id', studentId) },
    { name: 'student_exam_concept_analytics', q: supabase.from('student_exam_concept_analytics').select('*').eq('exam_id', realExamId).eq('student_id', studentId) },
    { name: 'student_cumulative_subject_analytics', q: supabase.from('student_cumulative_subject_analytics').select('*').eq('student_id', studentId) },
    { name: 'student_cumulative_chapter_analytics', q: supabase.from('student_cumulative_chapter_analytics').select('*').eq('student_id', studentId) },
    { name: 'student_cumulative_concept_analytics', q: supabase.from('student_cumulative_concept_analytics').select('*').eq('student_id', studentId) },
    { name: 'student_recommendations', q: supabase.from('student_recommendations').select('*').eq('exam_id', realExamId).eq('student_id', studentId) },
    { name: 'analytics_snapshots', q: supabase.from('analytics_snapshots').select('*').eq('exam_id', realExamId).eq('student_id', studentId) },
    { name: 'question_analytics', q: supabase.from('question_analytics').select('*').eq('exam_id', realExamId) },
  ];

  console.log("\nTable | Row Count | Example Row | PASS/FAIL");
  console.log("--------------------------------------------------");

  for (const t of tables) {
    const { data, error } = await t.q;
    if (error) {
      console.log(`${t.name} | ERROR | ${error.message} | FAIL`);
    } else {
      const count = data?.length || 0;
      const ex = count > 0 ? JSON.stringify(data[0]).substring(0, 50) + "..." : "None";
      const pass = count > 0 ? "PASS" : "FAIL";
      console.log(`${t.name} | ${count} | ${ex} | ${pass}`);
    }
  }

  console.log("\n--- Checking Telemetry in cbt_attempt_answers ---");
  const { data: answers, error: aErr } = await supabase.from('cbt_attempt_answers').select('time_taken_seconds, first_answer, answer_changed_count, marked_for_review, visited_count').eq('attempt_id', attemptId).limit(5);
  
  if (aErr) {
     console.error("Telemetry error:", aErr);
  } else if (answers && answers.length > 0) {
    console.log("Telemetry check PASS: ", JSON.stringify(answers[0]));
  } else {
    console.log("Telemetry check FAIL: No answers or fields missing.");
  }
}

run().catch(console.error);
