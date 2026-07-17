import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { runGeminiWorker } from "@/lib/background-jobs/gemini-worker";
import { solutionMetadataSchema } from "@/lib/solutions/solution-schema";

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log("Fetching a pending solution job...");
  const { data: leasedJobs, error: queueError } = await supabase.rpc("lease_and_charge_job_v4");
  
  if (queueError || !leasedJobs || leasedJobs.length === 0) {
    console.log("No pending jobs found. We need a question to process.");
    // Force a question to pending
    const { data: q } = await supabase.from("exam_questions").select("id").limit(1).single();
    if (q) {
      await supabase.from("solution_generation_queue").update({ status: 'PENDING' }).eq("question_id", q.id);
      console.log("Set question " + q.id + " to PENDING. Run this script again.");
    }
    return;
  }

  const job = leasedJobs[0];
  console.log("Running Gemini Worker on job " + job.id + " (question " + job.question_id + ")...");
  
  // Actually run the worker, but wait, the lease already fetched it.
  // I will just use runGeminiWorker, but runGeminiWorker does its own lease!
  // Let's release the job so runGeminiWorker can grab it.
  await supabase.from("solution_generation_queue").update({ status: 'PENDING' }).eq("id", job.id);
  
  const result = await runGeminiWorker("verifier");
  console.log("Worker Result:", result);

  if (result.status !== "COMPLETED") {
    console.log("FAIL: Worker did not complete. Reason:", result.reason);
    process.exit(1);
  }

  console.log("Loading question_solutions row...");
  const { data: sol } = await supabase.from("question_solutions").select("ai_metadata").eq("question_id", job.question_id).single();

  if (!sol || !sol.ai_metadata) {
    console.log("FAIL: No solution saved or ai_metadata is null.");
    process.exit(1);
  }

  console.log("Asserting all required fields exist...");
  try {
    solutionMetadataSchema.parse(sol.ai_metadata);
    console.log("PASS: Metadata exactly matches schema contract.");
  } catch (err: any) {
    console.log("FAIL with missing fields:", err.errors || err);
    process.exit(1);
  }
}

verify().catch(e => {
  console.error("FAIL:", e);
  process.exit(1);
});
