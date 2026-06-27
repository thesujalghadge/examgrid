import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const students = [
  "e1111111-1111-1111-1111-111111111111", // Student 1 (Failing)
  "e2222222-2222-2222-2222-222222222222", // Student 2 (Acing)
  "e3333333-3333-3333-3333-333333333333", // Student 3 (Average)
];

const exams = [
  "f1111111-1111-1111-1111-111111111111", // Exam 1
  "f2222222-2222-2222-2222-222222222222", // Exam 2
  "f3333333-3333-3333-3333-333333333333", // Exam 3
];

const batchId = "55555555-5555-5555-5555-555555555555";
const instId = "00000000-0000-0000-0000-000000000001";
const mockSubjectId = "a1111111-1111-1111-1111-111111111111";
const mockChapterId = "b1111111-1111-1111-1111-111111111111";
const mockConceptId = "c1111111-1111-1111-1111-111111111111";

async function run() {
  console.log("Setting up mock data...");
  // Clear previous data
  await supabase.from("analytics_jobs").delete().in("student_id", students);
  await supabase.from("student_cumulative_subject_analytics").delete().in("student_id", students);
  await supabase.from("student_cumulative_chapter_analytics").delete().in("student_id", students);
  await supabase.from("student_cumulative_concept_analytics").delete().in("student_id", students);
  await supabase.from("student_recommendations").delete().in("student_id", students);
  await supabase.from("cbt_attempt_answers").delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Clean answers
  await supabase.from("cbt_attempts").delete().in("student_id", students);
  await supabase.from("question_syllabus_mappings").delete().eq("institute_id", instId);

  // Insert mock students
  for (let s = 0; s < students.length; s++) {
    const { error: stuErr } = await supabase.from("students").upsert({
      id: students[s], institute_id: instId, batch_id: batchId, name: `Student ${s+1}`, full_name: `Student ${s+1}`, roll_number: `SIM_${s+1}`, application_number: `APP_${s+1}`
    });
    if (stuErr) console.error("Students Err", stuErr);
  }

  // Mappings infrastructure is shared with fix_audit_real
  // We'll create 3 questions per exam (9 questions total)
  let qIndex = 0;
  for (let e = 0; e < exams.length; e++) {
    const examId = exams[e];
    
    // We mock the exam_questions to be mapped
    // Note: The worker looks up real questions from exam_questions using exam_id! 
    // We MUST insert them into exam_questions so `realQuestionsMap` works.
    const { error: examErr } = await supabase.from("exams").upsert({
      id: examId, title: `Sim Exam ${e+1}`, institute_id: instId, total_questions: 3, exam_type: "JEE_MAIN", duration_minutes: 60, scheduled_at: new Date().toISOString()
    });
    if (examErr) console.error("Exam Err", examErr);

    const sectionId = `s${e+1}111111-1111-1111-1111-111111111111`;
    const { error: secErr } = await supabase.from("exam_sections").upsert({
      id: sectionId, exam_id: examId, name: "Section A", sort_order: 1, institute_id: instId
    });
    if (secErr) console.error("Sec Err", secErr);

    for (let q = 1; q <= 3; q++) {
      const qId = `d${e+1}111111-1111-1111-1111-11111111111${q}`;
      const { error: eqErr } = await supabase.from("exam_questions").upsert({
         id: qId, exam_id: examId, section_id: sectionId, institute_id: instId, question_number: q, question_type: 'MCQ_SINGLE', question_text: "Mock Question", marks: 4, negative_marks: 1
      });
      if (eqErr) console.error("EQ Err", eqErr);

      const { error: mapErr } = await supabase.from("question_syllabus_mappings").upsert({
        question_id: qId, batch_id: batchId, institute_id: instId,
        syllabus_subject_id: mockSubjectId, syllabus_chapter_id: mockChapterId, syllabus_topic_id: mockConceptId,
        mapping_method: "MANUAL_CORRECTION"
      });
      if (mapErr) console.error("Mapping Err", mapErr);
    }
  }

  // Generate Attempts
  for (let s = 0; s < students.length; s++) {
    const studentId = students[s];
    
    for (let e = 0; e < exams.length; e++) {
      const examId = exams[e];
      const attemptId = `a${s+1}${e+1}11111-1111-1111-1111-111111111111`;
      const testId = `cbt-${examId}-paper-sim`;
      
      const { error: cbtErr } = await supabase.from("cbt_attempts").upsert({
        id: attemptId, test_id: testId, student_id: studentId, institute_id: instId,
        student_roll_number: `SIM_${s+1}`, status: "submitted", session_id: `test-sess-${attemptId}`,
        total_questions: 3, attempted_questions: 3, score: s === 1 ? 12 : (s === 0 ? 0 : 4),
        started_at: new Date().toISOString(), submitted_at: new Date().toISOString()
      });
      if (cbtErr) console.error("CBT Err", cbtErr);

      // Answers
      for (let q = 1; q <= 3; q++) {
        let isCorrect = false;
        if (s === 1) isCorrect = true;
        if (s === 2 && q === 1) isCorrect = true;

        const { error: ansErr } = await supabase.from("cbt_attempt_answers").upsert({
          attempt_id: attemptId, question_id: `question-${q}`, is_correct: isCorrect, marks_awarded: isCorrect ? 4 : -1,
          selected_answer: "A", time_taken_seconds: 60, first_answer: "A", answer_changed_count: 0,
          marked_for_review: false, visited_count: 1
        });
        if (ansErr) console.error("Ans Err", ansErr);
      }

      // Queue Analytics
      const { error: jobErr } = await supabase.from("analytics_jobs").upsert({
        id: attemptId, attempt_id: attemptId, student_id: studentId, exam_id: testId, batch_id: batchId, status: "PENDING"
      });
      if (jobErr) console.error("Job Err", jobErr);
    }
  }

  console.log("Running worker for 9 attempts...");
  const { runAnalyticsWorker } = await import("../src/lib/analytics/worker");
  await runAnalyticsWorker();

  console.log("\n--- Cumulative Analytics Check ---");
  const { data: cumu } = await supabase.from('student_cumulative_chapter_analytics').select('student_id, total_attempted, total_correct, overall_accuracy').order('student_id');
  console.table(cumu);

  console.log("\n--- Recommendations Check ---");
  const { data: recs } = await supabase.from('student_recommendations').select('*');
  console.table(recs);
}

run().catch(console.error);
