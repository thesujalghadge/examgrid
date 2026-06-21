import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("Starting Solution Pipeline Audit...\n");

  // Get the most recently published exam
  const { data: latestExam } = await supabase
    .from("exams")
    .select("id, title")
    .eq("is_published", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (!latestExam) {
    console.log("No published exams found.");
    return;
  }

  console.log(`Auditing Exam: ${latestExam.title} (ID: ${latestExam.id})\n`);

  // 1. Count rows
  const { count: eqCount } = await supabase
    .from("exam_questions")
    .select("*", { count: "exact", head: true })
    .eq("exam_id", latestExam.id);

  console.log(`exam_questions count: ${eqCount}`);

  // Need to get all question IDs for this exam to count queue and solutions
  const { data: questions } = await supabase
    .from("exam_questions")
    .select("id")
    .eq("exam_id", latestExam.id);
  
  const questionIds = questions?.map(q => q.id) || [];

  const { count: queueCount } = await supabase
    .from("solution_generation_queue")
    .select("*", { count: "exact", head: true })
    .in("question_id", questionIds);

  console.log(`solution_generation_queue count: ${queueCount}`);

  const { count: solutionCount } = await supabase
    .from("question_solutions")
    .select("*", { count: "exact", head: true })
    .in("question_id", questionIds);

  console.log(`question_solutions count: ${solutionCount}\n`);

  // 2. Queue status breakdown
  const { data: queueStatuses } = await supabase
    .from("solution_generation_queue")
    .select("status")
    .in("question_id", questionIds);

  const statusCounts = (queueStatuses || []).reduce((acc: any, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {});

  console.log("Queue Status Breakdown:");
  for (const [status, count] of Object.entries(statusCounts)) {
    console.log(`${status}: ${count}`);
  }
  console.log("");

  // 3. First 5 queue rows
  const { data: top5Queue } = await supabase
    .from("solution_generation_queue")
    .select("question_id, status, attempts, failure_stage, failure_reason, next_retry_at")
    .in("question_id", questionIds)
    .limit(5);

  console.log("First 5 queue rows:");
  console.table(top5Queue);
  console.log("");

  // 4. Verify worker currently consuming jobs
  // Check the queue for any row with status = 'PROCESSING' or check the last updated time of COMPLETED rows
  const { data: lastCompleted } = await supabase
    .from("solution_generation_queue")
    .select("updated_at")
    .in("question_id", questionIds)
    .eq("status", "COMPLETED")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  const { data: lastProcessed } = await supabase
    .from("solution_generation_queue")
    .select("updated_at")
    .in("question_id", questionIds)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  console.log(`Last processed queue row (updated_at): ${lastProcessed?.updated_at || 'N/A'}`);
  console.log(`Last completed solution (updated_at): ${lastCompleted?.updated_at || 'N/A'}`);

  // Check audit_logs or solution events if they exist
  const { data: latestEvent } = await supabase
    .from("audit_logs")
    .select("timestamp_utc, action_type")
    .ilike("action_type", "%solution%")
    .order("timestamp_utc", { ascending: false })
    .limit(1)
    .single();

  console.log(`Latest solution event (audit_logs): ${latestEvent?.action_type || 'N/A'} at ${latestEvent?.timestamp_utc || 'N/A'}`);

}

runAudit().catch(console.error);
