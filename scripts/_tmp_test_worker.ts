import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Checking for PENDING queue rows...");
  const { data: beforeRows } = await supabase.from("solution_generation_queue").select("*").eq("status", "PENDING");
  
  if (!beforeRows || beforeRows.length === 0) {
    console.log("No PENDING rows found. Please publish a test.");
    return;
  }
  
  console.log(`Found ${beforeRows.length} PENDING rows.`);
  const beforeState = Object.fromEntries(beforeRows.map(r => [r.question_id, r]));

  console.log("Invoking worker...");
  try {
    const res = await fetch("http://localhost:3000/api/internal/solution-worker", {
      headers: { "Authorization": `Bearer ${process.env.CRON_SECRET || 'dev-secret'}` }
    });
    console.log("Worker response status:", res.status);
    const text = await res.text();
    console.log("Worker response body:", text);
  } catch (err) {
    console.error("Worker fetch failed:", err);
  }

  // Wait a few seconds for the worker loop to process...
  console.log("Waiting 60 seconds for worker to process...");
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  // Re-check queue rows
  const questionIds = beforeRows.map(r => r.question_id);
  const { data: afterRows } = await supabase.from("solution_generation_queue").select("*").in("question_id", questionIds);
  const afterState = Object.fromEntries((afterRows || []).map(r => [r.question_id, r]));

  console.log("\n--- TRACE ---");
  for (const qid of questionIds) {
    const before = beforeState[qid];
    const after = afterState[qid];
    
    // Check if solution exists
    const { data: sol } = await supabase.from("question_solutions").select("id").eq("question_id", qid).limit(1);
    const created = sol && sol.length > 0 ? "YES" : "NO";

    console.log(`\nQuestion ID: ${qid}`);
    console.log(`status_before: ${before.status}`);
    console.log(`status_after: ${after?.status}`);
    console.log(`attempts: ${after?.attempts}`);
    console.log(`charged_requests: ${after?.charged_requests}`);
    console.log(`last_error: ${after?.last_error}`);
    console.log(`question_solution_created: ${created}`);
  }

  // Check exam solution status
  const examId = beforeRows[0].exam_id; 
  // Wait, solution_generation_queue doesn't have exam_id. We have to join or use institute_id.
  const { data: status } = await supabase.from("exam_solution_status").select("*").eq("institute_id", beforeRows[0].institute_id);
  console.log("\n--- EXAM SOLUTION STATUS ---");
  console.log(status);
}
run();
