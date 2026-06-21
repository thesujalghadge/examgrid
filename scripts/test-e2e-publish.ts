import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const instituteId = "ddcc7407-fbb6-42bd-9751-576ef43e2241";
  const examUuid = crypto.randomUUID();
  const legacyId = `P08B-TEST-${Date.now()}`;
  
  console.log(`Creating fresh exam with legacy ID: ${legacyId} and UUID: ${examUuid}`);

  // 1. Simulate what SupabaseExamRepository.persistExam does
  const { error: examErr } = await supabase.from("exams").insert({
    id: examUuid,
    legacy_id: legacyId,
    institute_id: instituteId,
    title: "P0.8B Publish Flow Test",
    exam_type: "JEE_MAIN",
    duration_minutes: 180,
    total_questions: 15,
    is_published: false,
    scheduled_at: new Date().toISOString()
  });

  if (examErr) throw new Error("Failed to insert exam: " + examErr.message);

  const sectionId = crypto.randomUUID();
  const { error: secErr } = await supabase.from("exam_sections").insert({
    id: sectionId,
    exam_id: examUuid,
    institute_id: instituteId,
    name: "Section 1",
    sort_order: 0
  });
  if (secErr) throw new Error("Failed to insert section: " + secErr.message);

  const questions = Array.from({ length: 15 }).map((_, i) => ({
    id: crypto.randomUUID(),
    exam_id: examUuid,
    institute_id: instituteId,
    section_id: sectionId,
    question_number: i + 1,
    question_type: "MCQ_SINGLE",
    question_text: `Test Question ${i + 1}`,
    options: [{ id: "A", label: "A", text: "1" }],
    correct_option_id: "A",
    marks: 4,
    negative_marks: 1,
    sort_order: i
  }));

  const { error: qErr } = await supabase.from("exam_questions").insert(questions);
  if (qErr) throw new Error("Failed to insert questions: " + qErr.message);

  console.log(`Inserted ${questions.length} questions into exam_questions.`);

  // 2. Simulate the UI calling the publish API
  console.log(`Hitting Publish API with legacy ID: ${legacyId}...`);
  const url = `http://localhost:3000/api/institute/${instituteId}/tests/${legacyId}/publish`;
  const res = await fetch(url, { method: "POST" });
  const text = await res.text();
  console.log(`API Status: ${res.status}`);
  console.log(`API Response: ${text}`);

  // 3. Verify queue
  const { count: queueCount } = await supabase
    .from("solution_generation_queue")
    .select("*", { count: "exact", head: true })
    .eq("institute_id", instituteId)
    .in("question_id", questions.map(q => q.id));

  console.log(`Verification:`);
  console.log(`Exam Questions inserted: ${questions.length}`);
  console.log(`Solution Generation Queue rows created: ${queueCount}`);
}

run().catch(console.error);
