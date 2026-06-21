import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const examId = "d18c20cf-7c4b-455c-b2b5-098e0919ebac";
  const instituteId = "ddcc7407-fbb6-42bd-9751-576ef43e2241";

  // 1. Clear queue
  const { data: questions } = await supabase.from("exam_questions").select("id").eq("exam_id", examId);
  const qIds = questions?.map(q => q.id) || [];
  if (qIds.length > 0) {
    await supabase.from("solution_generation_queue").delete().in("question_id", qIds);
  }

  // 2. Reset exam
  await supabase.from("exams").update({ is_published: false, status: 'DRAFT', solutions_release_time: null }).eq("id", examId);

  // 3. Reset exam_questions published_at
  await supabase.from("exam_questions").update({ published_at: null }).eq("exam_id", examId);

  console.log("Exam reset. Hitting Publish API...");

  // 4. Hit publish API
  const url = `http://localhost:3000/api/institute/${instituteId}/tests/${examId}/publish`;
  try {
    const res = await fetch(url, { method: "POST" });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text}`);
  } catch (e: any) {
    console.error("Fetch error:", e.message);
  }

  // 5. Verify queue
  const { count } = await supabase.from("solution_generation_queue").select("*", { count: "exact" }).in("question_id", qIds);
  console.log(`Queue count after publish: ${count}`);
}

run().catch(console.error);
