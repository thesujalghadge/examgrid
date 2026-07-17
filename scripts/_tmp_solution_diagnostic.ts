import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  // 1 & 2. Find attempt and exam
  const { data: attempts } = await supabase
    .from("cbt_attempts")
    .select("id, test_id, institute_id, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!attempts || attempts.length === 0) {
    console.log("No attempts found.");
    return;
  }
  const attempt = attempts[0];
  console.log(`\n--- ATTEMPT INFO ---`);
  console.log(`Attempt ID: ${attempt.id}`);
  console.log(`Exam ID: ${attempt.test_id}`);
  console.log(`Institute ID: ${attempt.institute_id}`);

  // 3. Queue Rows
  const { data: queueRows } = await supabase
    .from("solution_generation_queue")
    .select("*")
    .eq("institute_id", attempt.institute_id); // Assuming all questions from this institute

  console.log(`\n--- QUEUE ROWS ---`);
  if (!queueRows || queueRows.length === 0) {
    console.log("No queue rows found.");
  } else {
    for (const row of queueRows) {
      console.log(`\nQuestion ID: ${row.question_id}`);
      console.log(`Current Status: ${row.status}`);
      console.log(`Attempts: ${row.attempts}`);
      console.log(`charged_requests: ${row.charged_requests}`);
      console.log(`leased_at: ${row.leased_at}`);
      console.log(`next_retry_at: ${row.next_retry_at}`);
      console.log(`last_error: ${row.last_error}`);
      console.log(`institute_id: ${row.institute_id}`);
    }
  }

  // 4. Question Solutions
  const { data: solutions } = await supabase
    .from("question_solutions")
    .select("id, question_id, is_active")
    .eq("institute_id", attempt.institute_id);

  console.log(`\n--- QUESTION SOLUTIONS ---`);
  console.log(`Total solutions for institute: ${solutions?.length || 0}`);

  // 5. Gemini Usage Budget
  const { data: budget } = await supabase
    .from("gemini_usage_budget")
    .select("*")
    .eq("institute_id", attempt.institute_id);

  console.log(`\n--- GEMINI USAGE BUDGET ---`);
  console.log(budget);

  // 6. Worker Lock
  const { data: lock } = await supabase
    .from("solution_worker_lock")
    .select("*");

  console.log(`\n--- SOLUTION WORKER LOCK ---`);
  console.log(lock);

  // 7. Exam Solution Status
  const { data: status } = await supabase
    .from("exam_solution_status")
    .select("*")
    .eq("exam_id", attempt.test_id)
    .eq("institute_id", attempt.institute_id);
    
  console.log(`\n--- EXAM SOLUTION STATUS ---`);
  console.log(status);
}

run().catch(console.error);
