import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PROCESSING_TIMEOUT_MINUTES = 15;

async function recoverSolutionQueue(replayFailed = false) {
  console.log(`\n--- Recovering Solution Generation Queue ---`);
  
  const timeoutLimit = new Date(Date.now() - PROCESSING_TIMEOUT_MINUTES * 60000).toISOString();

  // 1. Recover STUCK PROCESSING jobs
  const { data: stuckJobs, error: stuckErr } = await supabase
    .from("solution_generation_queue")
    .select("id, attempts, max_attempts")
    .eq("status", "PROCESSING")
    .lt("started_at", timeoutLimit); // We would need started_at, but we'll use updated_at

  if (stuckErr) {
    console.error(`❌ Error fetching stuck solution jobs: ${stuckErr.message}`);
  } else if (stuckJobs && stuckJobs.length > 0) {
    console.log(`⚠️ Found ${stuckJobs.length} stuck PROCESSING solution jobs. Resetting...`);
    for (const job of stuckJobs) {
      if ((job.attempts || 0) >= (job.max_attempts || 3)) {
        await supabase.from("solution_generation_queue").update({
          status: "FAILED",
          error_log: "Job timed out and exceeded max attempts",
          failure_reason: "TIMEOUT"
        }).eq("id", job.id);
        console.log(`   -> Job ${job.id} moved to DEAD-LETTER (FAILED)`);
      } else {
        await supabase.from("solution_generation_queue").update({
          status: "PENDING",
          attempts: (job.attempts || 0) + 1,
          error_log: "Recovered from stuck PROCESSING state"
        }).eq("id", job.id);
        console.log(`   -> Job ${job.id} RE-QUEUED (Attempt ${(job.attempts || 0) + 1})`);
      }
    }
  } else {
    console.log(`✅ No stuck PROCESSING solution jobs found.`);
  }

  // 2. Replay FAILED jobs if requested
  if (replayFailed) {
    const { data: failedJobs, error: failErr } = await supabase
      .from("solution_generation_queue")
      .select("id")
      .eq("status", "FAILED");

    if (failErr) {
      console.error(`❌ Error fetching failed solution jobs: ${failErr.message}`);
    } else if (failedJobs && failedJobs.length > 0) {
      console.log(`♻️ Replaying ${failedJobs.length} FAILED solution jobs...`);
      const ids = failedJobs.map(j => j.id);
      await supabase.from("solution_generation_queue").update({
        status: "PENDING",
        attempts: 0,
        error_log: "Manually re-queued by recovery script"
      }).in("id", ids);
      console.log(`   -> All FAILED solution jobs moved to PENDING`);
    } else {
      console.log(`✅ No FAILED solution jobs to replay.`);
    }
  }
}

async function recoverAnalyticsQueue(replayFailed = false) {
  console.log(`\n--- Recovering Analytics Jobs Queue ---`);
  
  const timeoutLimit = new Date(Date.now() - PROCESSING_TIMEOUT_MINUTES * 60000).toISOString();

  // 1. Recover STUCK PROCESSING jobs
  const { data: stuckJobs, error: stuckErr } = await supabase
    .from("analytics_jobs")
    .select("id")
    .eq("status", "PROCESSING")
    .lt("updated_at", timeoutLimit);

  if (stuckErr) {
    console.error(`❌ Error fetching stuck analytics jobs: ${stuckErr.message}`);
  } else if (stuckJobs && stuckJobs.length > 0) {
    console.log(`⚠️ Found ${stuckJobs.length} stuck PROCESSING analytics jobs. Resetting...`);
    const ids = stuckJobs.map(j => j.id);
    await supabase.from("analytics_jobs").update({
      status: "PENDING",
      error_text: "Recovered from stuck PROCESSING state"
    }).in("id", ids);
    console.log(`   -> ${ids.length} analytics jobs RE-QUEUED to PENDING`);
  } else {
    console.log(`✅ No stuck PROCESSING analytics jobs found.`);
  }

  // 2. Replay FAILED jobs if requested
  if (replayFailed) {
    const { data: failedJobs, error: failErr } = await supabase
      .from("analytics_jobs")
      .select("id")
      .eq("status", "FAILED");

    if (failErr) {
      console.error(`❌ Error fetching failed analytics jobs: ${failErr.message}`);
    } else if (failedJobs && failedJobs.length > 0) {
      console.log(`♻️ Replaying ${failedJobs.length} FAILED analytics jobs...`);
      const ids = failedJobs.map(j => j.id);
      await supabase.from("analytics_jobs").update({
        status: "PENDING",
        error_text: "Manually re-queued by recovery script"
      }).in("id", ids);
      console.log(`   -> All FAILED analytics jobs moved to PENDING`);
    } else {
      console.log(`✅ No FAILED analytics jobs to replay.`);
    }
  }
}

const isReplay = process.argv.includes("--replay-failed");

async function run() {
  await recoverSolutionQueue(isReplay);
  await recoverAnalyticsQueue(isReplay);
  console.log("\nRecovery complete.\n");
}

run().catch(console.error);
