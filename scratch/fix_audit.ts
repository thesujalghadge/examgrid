import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const examId = "11111111-1111-1111-1111-111111111111";
  const studentId = "22222222-2222-2222-2222-222222222222";
  const attemptId = "33333333-3333-3333-3333-333333333333";
  const questionId = "44444444-4444-4444-4444-444444444444";
  const batchId = "55555555-5555-5555-5555-555555555555";
  const sectionId = "66666666-6666-6666-6666-666666666666";

  const mockSubjectId = "s1111111-1111-1111-1111-111111111111";
  const mockChapterId = "c1111111-1111-1111-1111-111111111111";
  const mockConceptId = "p1111111-1111-1111-1111-111111111111";

  console.log("Cleaning up previous run...");
  await supabase.from('cbt_attempts').delete().eq('id', attemptId);
  await supabase.from('exam_questions').delete().eq('id', questionId);
  await supabase.from('exams').delete().eq('id', examId);
  await supabase.from('exam_sections').delete().eq('id', sectionId);

  console.log("Injecting relational data...");
  await supabase.from('exams').upsert({ id: examId, title: "Test Exam", institute_id: "00000000-0000-0000-0000-000000000001", total_questions: 1 });
  await supabase.from('exam_sections').upsert({ id: sectionId, exam_id: examId, institute_id: "00000000-0000-0000-0000-000000000001", name: "Physics", sort_order: 1 });
  await supabase.from('exam_questions').upsert({
    id: questionId, exam_id: examId, section_id: sectionId, institute_id: "00000000-0000-0000-0000-000000000001",
    question_number: 1, question_type: 'MCQ_SINGLE', marks: 4, negative_marks: 1
  });

  await supabase.from('batch_syllabus_nodes').upsert([
    { id: mockSubjectId, name: 'Mock Subject', type: 'SUBJECT', parent_id: null },
    { id: mockChapterId, name: 'Mock Chapter', type: 'CHAPTER', parent_id: mockSubjectId },
    { id: mockConceptId, name: 'Mock Concept', type: 'CONCEPT', parent_id: mockChapterId }
  ]);

  await supabase.from('question_syllabus_mappings').upsert({
    question_id: questionId, batch_id: batchId,
    syllabus_subject_id: mockSubjectId, syllabus_chapter_id: mockChapterId, syllabus_topic_id: mockConceptId,
    difficulty_level: 2
  });

  await supabase.from('cbt_attempts').upsert({
    id: attemptId, test_id: examId, student_id: studentId, batch_id: batchId,
    student_roll_number: "TEST001", status: "submitted", session_id: "test-sess",
    started_at: new Date().toISOString(), submitted_at: new Date().toISOString()
  });

  await supabase.from('cbt_attempt_answers').upsert({
    attempt_id: attemptId, question_id: questionId, is_correct: true, marks_awarded: 4,
    selected_answer: "A", time_taken_seconds: 45, first_answer: "A", answer_changed_count: 0,
    marked_for_review: false, visited_count: 1
  });

  await supabase.from('analytics_jobs').upsert({
    id: attemptId, attempt_id: attemptId, student_id: studentId, exam_id: examId, batch_id: batchId, status: "PENDING"
  });

  console.log("Running worker...");
  const { runAnalyticsWorker } = await import("../src/lib/analytics/worker");
  await runAnalyticsWorker();

  const tables = [
    { name: 'analytics_jobs', q: supabase.from('analytics_jobs').select('*').eq('attempt_id', attemptId) },
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
}

run().catch(console.error);
