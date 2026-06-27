import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("--- 1. Current Queue State ---");
  const { data: q1, error: err1 } = await supabase.from('solution_generation_queue').select('status');
  if (err1) console.error(err1);
  const counts: Record<string, number> = {};
  for (const row of q1 || []) {
    counts[row.status] = (counts[row.status] || 0) + 1;
  }
  console.table(counts);

  console.log("\n--- 2. Failing Jobs ---");
  const { data: q2, error: err2 } = await supabase
    .from('solution_generation_queue')
    .select('id, status, last_error, attempts, updated_at')
    .in('status', ['FAILED', 'WAITING_RETRY'])
    .order('updated_at', { ascending: false })
    .limit(20);
  if (err2) console.error(err2);
  console.table(q2);

  console.log("\n--- 5. Post Recovery Queue Query (preview) ---");
  console.table(counts); // Same as 1 initially

  console.log("\n--- 6. Exam Aggregation ---");
  const { data: q6, error: err6 } = await supabase
    .from('solution_generation_queue')
    .select('status, question_id, exam_questions(exam_id)');
  if (err6) console.error(err6);
  
  const examMap: Record<string, { total: number; completed: number }> = {};
  for (const row of q6 || []) {
    const eId = (row.exam_questions as any)?.exam_id || "unknown";
    if (!examMap[eId]) examMap[eId] = { total: 0, completed: 0 };
    examMap[eId].total++;
    if (row.status === 'COMPLETED') examMap[eId].completed++;
  }
  console.table(examMap);

  console.log("\n--- 7. Worker Lock State ---");
  const { data: q7, error: err7 } = await supabase.from('global_worker_state').select('*');
  if (err7) {
    console.log("Could not query global_worker_state (table might not exist yet if migration wasn't run on DB directly)");
    console.error(err7.message);
  } else {
    console.table(q7);
  }
}

main().catch(console.error);
