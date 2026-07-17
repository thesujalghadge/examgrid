import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";
import crypto from "crypto";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, serviceRoleKey);

async function verify() {
  console.log("Starting Multi-Student Production Verification...");
  
  // 1. Institute Setup
  const instId = "183235f9-1535-4e51-925e-8fffaebf1c85";

  // Get 3 Students
  const { data: students } = await supabase.from("students").select("id, roll_number, batch_id").eq("institute_id", instId).limit(3);
  if (!students || students.length < 3) throw new Error("Not enough students found in institute. Need at least 3.");
  
  console.log(`✅ Institute and ${students.length} Students retrieved.`);

  // 3. Create Exam
  const examId = crypto.randomUUID();
  const examDef = {
    id: examId,
    title: "Multi-Student Rank Verification Exam",
    durationMinutes: 60,
    examType: "JEE_MAIN"
  };

  await supabase.from("exams").insert({
    id: examId,
    institute_id: instId,
    title: examDef.title,
    duration_minutes: examDef.durationMinutes,
    exam_type: examDef.examType,
    scheduled_at: new Date().toISOString(),
    is_published: true,
    total_questions: 2
  });

  await supabase.from("exam_sections").insert({
    exam_id: examId,
    id: "sec-phy",
    name: "Physics",
    institute_id: instId
  });

  const q1 = crypto.randomUUID();
  const q2 = crypto.randomUUID();

  await supabase.from("exam_questions").insert([
    {
      id: q1,
      exam_id: examId,
      institute_id: instId,
      section_id: "sec-phy",
      question_number: 1,
      question_type: "MCQ_SINGLE",
      question_text: "Q1: What is 2+2?",
      correct_option_id: "B",
      marks: 4,
      negative_marks: 1,
      options: [{"id":"A","text":"1"},{"id":"B","text":"4"},{"id":"C","text":"3"},{"id":"D","text":"5"}]
    },
    {
      id: q2,
      exam_id: examId,
      institute_id: instId,
      section_id: "sec-phy",
      question_number: 2,
      question_type: "MCQ_SINGLE",
      question_text: "Q2: What is 3+3?",
      correct_option_id: "C",
      marks: 4,
      negative_marks: 1,
      options: [{"id":"A","text":"2"},{"id":"B","text":"4"},{"id":"C","text":"6"},{"id":"D","text":"8"}]
    }
  ]);
  
  console.log(`✅ Test created: ${examId}`);

  // Assign Test to all batches of these students
  const batchIds = [...new Set(students.map(s => s.batch_id))];
  for (const bid of batchIds) {
    const scheduleId = crypto.randomUUID();
    await supabase.from("exam_schedules").insert({
      id: scheduleId,
      exam_id: examId,
      institute_id: instId,
      start_at: new Date(Date.now() - 3600000).toISOString(),
      end_at: new Date(Date.now() + 86400000).toISOString(),
      duration_minutes: 60
    });
    await supabase.from("exam_schedule_batches").insert({
      schedule_id: scheduleId,
      batch_id: bid,
      institute_id: instId
    });
  }

  console.log(`✅ Test Assigned to batches`);

  // 5. Attempt Test for 3 students with different scores
  const scenarios = [
    { s: students[0], ans1: "B", ans2: "C", s1: true, s2: true, m1: 4, m2: 4, tot: 8 },
    { s: students[1], ans1: "B", ans2: "A", s1: true, s2: false, m1: 4, m2: -1, tot: 3 },
    { s: students[2], ans1: "A", ans2: "B", s1: false, s2: false, m1: -1, m2: -1, tot: -2 }
  ];

  for (const scen of scenarios) {
    const attemptId = crypto.randomUUID();
    const sessionId = crypto.randomUUID();
    await supabase.from("cbt_attempts").insert({
      id: attemptId,
      test_id: examId,
      student_id: scen.s.id,
      student_roll_number: scen.s.roll_number,
      institute_id: instId,
      session_id: sessionId,
      status: "submitted",
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      score: scen.tot,
      total_questions: 2,
      attempted_questions: 2,
      accuracy: scen.tot === 8 ? 100 : (scen.tot === 3 ? 50 : 0)
    });
    
    await supabase.from("cbt_attempt_answers").insert([
      { attempt_id: attemptId, question_id: q1, selected_answer: scen.ans1, time_taken_seconds: 15, is_correct: scen.s1, marks_awarded: scen.m1 },
      { attempt_id: attemptId, question_id: q2, selected_answer: scen.ans2, time_taken_seconds: 20, is_correct: scen.s2, marks_awarded: scen.m2 }
    ]);
    
    // Add job
    await supabase.from("analytics_jobs").insert({
      exam_id: examId,
      institute_id: instId,
      student_id: scen.s.id,
      attempt_id: attemptId,
      batch_id: scen.s.batch_id,
      status: "PENDING"
    });
  }
  
  console.log(`✅ Attempts completed and Analytics Jobs queued`);

  // Trigger Analytics Worker manually via HTTP
  const triggerRes = await fetch("http://localhost:3000/api/internal/analytics/trigger-worker", { method: "POST" });
  if (!triggerRes.ok) throw new Error(`Worker trigger failed: ${triggerRes.statusText}`);

  console.log(`✅ Analytics worker triggered. Waiting 5 seconds...`);
  await new Promise(res => setTimeout(res, 5000));
  
  const { data: jobs } = await supabase.from("analytics_jobs").select("*").eq("exam_id", examId);
  console.log("Analytics Jobs Status:");
  jobs?.forEach(j => console.log(`  - Job ${j.id}: ${j.status}`));

  const { data: ranks } = await supabase.from("cbt_results").select("score, rank, percentile").order("rank", { ascending: true });
  console.log("Leaderboard Results:");
  ranks?.slice(0, 3).forEach(r => console.log(`  - Score: ${r.score} | Rank: ${r.rank} | Percentile: ${r.percentile}`));

  // Solutions worker 
  const solTrigger = await fetch("http://localhost:3000/api/internal/solution-worker", { method: "POST" });
  console.log(`✅ Solutions worker triggered (${solTrigger.status})`);
  
  console.log(`\n\nExam ID for Browser verification: ${examId}`);
  console.log(`Student Roll Numbers: ${scenarios.map(s => s.s.roll_number).join(', ')}`);
  console.log("Done.");
}

verify().catch(console.error);
