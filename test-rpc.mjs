import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Use dotenv to get env vars if not passed directly, but for this script we assume they're present.
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const inst = "11111111-1111-1111-1111-111111111111";
const examId = crypto.randomUUID();
const sectionId = crypto.randomUUID();
const qId = crypto.randomUUID();
const studentId = crypto.randomUUID();

async function run() {
  await supabase.from("institutes").upsert({ id: inst, name: "Test" }, { onConflict: "id" });
  await supabase.from("students").upsert({ id: studentId, institute_id: inst, name: "Test", roll_number: "R1" });
  await supabase.from("exams").insert({ id: examId, institute_id: inst, title: "Test", exam_type: "JEE_MAIN", duration_minutes: 60, scheduled_at: new Date().toISOString() });
  await supabase.from("exam_sections").insert({ id: sectionId, exam_id: examId, name: "Main", question_ids: [qId] });
  await supabase.from("exam_questions").insert({ id: qId, exam_id: examId, section_id: sectionId, institute_id: inst, question_number: 1, question_type: "MCQ_SINGLE", question_text: "Q1" });

  const breakdown = {
    correct: 1, incorrect: 0, unattempted: 0, attempted: 1, maxScore: 4, rawScore: 4, integrityPenalty: 0, finalScore: 4, durationSeconds: 60,
    perQuestion: [{
      questionId: qId,
      legacyClientKey: qId,
      selected: "A", correct: true, marksAwarded: 4, maxMarks: 4
    }]
  };

  const { data, error } = await supabase.rpc("submit_cbt_attempt", {
    p_session_id: crypto.randomUUID(),
    p_test_id: examId,
    p_institute_id: inst,
    p_student_id: studentId,
    p_status: "submitted",
    p_started_at: new Date().toISOString(),
    p_submitted_at: new Date().toISOString(),
    p_answers: {},
    p_result_breakdown: breakdown,
    p_integrity_score: 100,
    p_flagged: false
  });
  console.log(error || data);
}
run();
