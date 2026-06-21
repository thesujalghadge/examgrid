import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking exams table...");
  const { data: exams, error: eErr } = await supabase.from("exams").select("id, title, created_at");
  if (eErr) console.error(eErr);
  else console.log("Exams:", exams);

  console.log("Checking exam_questions table...");
  const { data: eq, error: eqErr } = await supabase.from("exam_questions").select("id, exam_id").limit(5);
  if (eqErr) console.error(eqErr);
  else console.log("Exam Questions:", eq);

  console.log("Checking cbt_attempts table...");
  const { data: att, error: attErr } = await supabase.from("cbt_attempts").select("id, exam_id").limit(5);
  if (attErr) console.error(attErr);
  else console.log("CBT Attempts:", att);

  console.log("Checking test_sessions table...");
  const { data: sess, error: sessErr } = await supabase.from("test_sessions").select("id, exam_id").limit(5);
  if (sessErr) console.error(sessErr);
  else console.log("Test Sessions:", sess);
}

run();
