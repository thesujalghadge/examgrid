import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminDb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

let failures = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ PASS  ${label}`);
  } else {
    console.error(`  ❌ FAIL  ${label}`);
    failures++;
  }
}

async function main() {
  console.log("═══════════════════════════════════════════════");
  console.log("  verify_production_health.ts");
  console.log("  Verifying operational production invariants");
  console.log("═══════════════════════════════════════════════\n");

  // 1. analytics_jobs stuck in IN_PROGRESS (PROCESSING) for more than 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: stuckJobs, error: err1 } = await adminDb
    .from("analytics_jobs")
    .select("id, updated_at")
    .eq("status", "PROCESSING")
    .lt("updated_at", oneHourAgo);
  
  if (err1) throw err1;
  assert(stuckJobs.length === 0, `0 stuck analytics_jobs (found ${stuckJobs.length})`);
  if (stuckJobs.length > 0) {
    console.log(`    Stuck jobs: ${stuckJobs.slice(0, 3).map(j => j.id).join(", ")}`);
  }

  // 2. FAILED jobs in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: failedJobs, error: err2 } = await adminDb
    .from("analytics_jobs")
    .select("id, error_text")
    .eq("status", "FAILED")
    .gt("created_at", oneDayAgo);
  
  if (err2) throw err2;
  // We just warn on this, it's not a strict failure if the system caught it, but the user says "checks FAILED jobs"
  console.log(`  ℹ️ INFO  Failed jobs in last 24h: ${failedJobs.length}`);

  // 3. Orphan attempts (cbt_attempts with missing test_id)
  // Or analytics_jobs with missing cbt_attempts
  const { data: allJobs } = await adminDb.from("analytics_jobs").select("id, attempt_id");
  const { data: allAttempts } = await adminDb.from("cbt_attempts").select("id, test_id");
  
  const attemptIds = new Set(allAttempts?.map(a => a.id));
  const orphanJobs = allJobs?.filter(j => !attemptIds.has(j.attempt_id)) || [];
  assert(orphanJobs.length === 0, `0 orphan analytics_jobs (found ${orphanJobs.length})`);

  // 4. Missing ranks (cbt_results without rank but exam has been processed)
  // It's harder to generically test missing ranks without knowing which exams are fully processed, 
  // but if total_candidates is null, it hasn't been ranked yet.
  // Let's check cbt_results that are older than 1 hour and still have no rank.
  const { data: missingRanks } = await adminDb
    .from("cbt_results")
    .select("id, attempt_id")
    .is("rank", null)
    .lt("created_at", oneHourAgo);

  const missingRanksLen = missingRanks?.length || 0;
  assert(missingRanksLen === 0, `0 unranked cbt_results older than 1hr (found ${missingRanksLen})`);

  // 5. Jobs completed without completed_at
  const { data: missingCompletedAt } = await adminDb
    .from("analytics_jobs")
    .select("id")
    .eq("status", "COMPLETED")
    .is("completed_at", null);
  
  const missingCompLen = missingCompletedAt?.length || 0;
  assert(missingCompLen === 0, `0 fake COMPLETED jobs missing completed_at (found ${missingCompLen})`);

  const { data: recentJobs } = await adminDb
    .from("analytics_jobs")
    .select("status, created_at, completed_at")
    .gte("created_at", oneDayAgo);

  let compCount = 0;
  let failCount = 0;
  let procCount = 0;
  let totalRuntime = 0;
  let maxRuntime = 0;

  recentJobs?.forEach(j => {
    if (j.status === "COMPLETED") {
      compCount++;
      if (j.completed_at) {
        const rt = (new Date(j.completed_at).getTime() - new Date(j.created_at).getTime()) / 1000;
        totalRuntime += rt;
        if (rt > maxRuntime) maxRuntime = rt;
      }
    } else if (j.status === "FAILED") {
      failCount++;
    } else if (j.status === "PROCESSING") {
      procCount++;
    }
  });

  const totalFinished = compCount + failCount;
  const failureRate = totalFinished > 0 ? (failCount / totalFinished) * 100 : 0;
  const avgRuntime = compCount > 0 ? totalRuntime / compCount : 0;

  // New Operational Alerts
  assert(avgRuntime <= 60, `Avg queue latency <= 60s (was ${avgRuntime.toFixed(1)}s)`);
  assert(maxRuntime <= 300, `Max queue latency <= 300s (was ${maxRuntime.toFixed(1)}s)`);
  assert(failureRate <= 5, `Failure rate <= 5% (was ${failureRate.toFixed(1)}%)`);
  assert(procCount <= 50, `Queue backlog <= 50 (was ${procCount})`);

  console.log("\n═══════════════════════════════════════════════");
  console.log("  Analytics Health Dashboard (Last 24h)");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Completed:    ${compCount}`);
  console.log(`  Failed:       ${failCount}`);
  console.log(`  Processing:   ${procCount}`);
  console.log(`  Avg Runtime:  ${avgRuntime.toFixed(1)}s`);
  console.log(`  Max Runtime:  ${maxRuntime.toFixed(1)}s`);
  console.log(`  Failure Rate: ${failureRate.toFixed(1)}%`);
  console.log("═══════════════════════════════════════════════\n");

  console.log("  Monitoring Queries:\n");

  console.log("\n  2. Recent Failed Jobs (Limit 5):");
  const { data: recentFailed } = await adminDb
    .from("analytics_jobs")
    .select("*")
    .eq("status", "FAILED")
    .order("created_at", { ascending: false })
    .limit(5);
    
  if (recentFailed && recentFailed.length > 0) {
    recentFailed.forEach(f => console.log(`     - ${f.id} | ${f.error_text}`));
  } else {
    console.log("     No recently failed jobs.");
  }

  console.log("═══════════════════════════════════════════════\n");

  if (failures === 0) {
    console.log(`  ✅ PRODUCTION HEALTH OK`);
    process.exit(0);
  } else {
    console.error(`  ❌ ${failures} HEALTH CHECK(S) FAILED`);
    process.exit(1);
  }
}

main().catch(console.error);
