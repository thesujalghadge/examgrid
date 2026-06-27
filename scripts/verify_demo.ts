/**
 * verify_demo.ts
 *
 * Pre-demo health verification script.
 * Runs a comprehensive set of checks to confirm the system is in
 * a clean, demo-ready state.
 *
 * Checks:
 *  1. Migrations applied  — global_worker_state table exists
 *  2. Worker unlocked     — is_running=false, worker_id IS NULL, expires_at IS NULL
 *  3. Queue empty         — no PENDING / PROCESSING / WAITING_RETRY jobs
 *  4. Analytics empty     — analytics_jobs and analytics_snapshots are empty
 *  5. No orphan solutions — question_solutions with no matching exam_question
 *  6. No orphan analytics — question_analytics with no matching exam_question
 *  7. Institute key live  — getInstituteGeminiKey() decrypts successfully
 *
 * Usage:
 *   npm run verify:demo
 *   npx tsx scripts/verify_demo.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// We need the encryption module — use dynamic require for CJS compat
const { getInstituteGeminiKey } = require("../src/lib/institute/get-institute-api-key");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const defaultInstituteId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckResult = {
  name: string;
  pass: boolean;
  detail: string;
};

// ── Checks ────────────────────────────────────────────────────────────────────

async function checkMigrationsApplied(): Promise<CheckResult> {
  const name = "Migrations applied";
  try {
    const { error } = await supabase
      .from("global_worker_state")
      .select("id")
      .limit(1);
    if (error) throw error;
    return { name, pass: true, detail: "global_worker_state table exists" };
  } catch (e: any) {
    return { name, pass: false, detail: `global_worker_state missing: ${e.message}` };
  }
}

async function checkWorkerUnlocked(): Promise<CheckResult> {
  const name = "Worker lock cleared";
  try {
    const { data, error } = await supabase
      .from("global_worker_state")
      .select("is_running, worker_id, expires_at")
      .eq("id", 1)
      .single();

    if (error) throw error;
    if (!data) return { name, pass: false, detail: "global_worker_state row missing" };

    const locked =
      data.is_running === true ||
      data.worker_id !== null ||
      data.expires_at !== null;

    if (locked) {
      return {
        name,
        pass: false,
        detail: `Lock active — is_running=${data.is_running}, worker_id=${data.worker_id}, expires_at=${data.expires_at}`,
      };
    }

    return { name, pass: true, detail: "is_running=false, worker_id=null, expires_at=null" };
  } catch (e: any) {
    return { name, pass: false, detail: e.message };
  }
}

async function checkQueueEmpty(): Promise<CheckResult> {
  const name = "Queue empty";
  try {
    const { data, error } = await supabase
      .from("solution_generation_queue")
      .select("id, status")
      .in("status", ["PENDING", "PROCESSING", "WAITING_RETRY"]);

    if (error) throw error;

    const count = data?.length ?? 0;
    if (count > 0) {
      const statusCounts = data!.reduce<Record<string, number>>((acc, row) => {
        acc[row.status] = (acc[row.status] || 0) + 1;
        return acc;
      }, {});
      return {
        name,
        pass: false,
        detail: `${count} active jobs found: ${JSON.stringify(statusCounts)}`,
      };
    }

    return { name, pass: true, detail: "0 active queue jobs" };
  } catch (e: any) {
    return { name, pass: false, detail: e.message };
  }
}

async function checkAnalyticsEmpty(): Promise<CheckResult> {
  const name = "Analytics empty";
  try {
    const [jobsRes, snapshotsRes] = await Promise.all([
      supabase.from("analytics_jobs").select("id", { count: "exact", head: true }),
      supabase.from("analytics_snapshots").select("id", { count: "exact", head: true }),
    ]);

    if (jobsRes.error) throw jobsRes.error;
    if (snapshotsRes.error) throw snapshotsRes.error;

    const jobs = jobsRes.count ?? 0;
    const snapshots = snapshotsRes.count ?? 0;

    if (jobs > 0 || snapshots > 0) {
      return {
        name,
        pass: false,
        detail: `analytics_jobs=${jobs}, analytics_snapshots=${snapshots}`,
      };
    }

    return { name, pass: true, detail: "analytics_jobs=0, analytics_snapshots=0" };
  } catch (e: any) {
    return { name, pass: false, detail: e.message };
  }
}

async function checkNoOrphanSolutions(): Promise<CheckResult> {
  const name = "No orphan solutions";
  try {
    // question_solutions where the question_id no longer exists in exam_questions
    const { data: solutions, error: sErr } = await supabase
      .from("question_solutions")
      .select("question_id");

    if (sErr) throw sErr;
    if (!solutions || solutions.length === 0) {
      return { name, pass: true, detail: "0 solutions, 0 orphans" };
    }

    const questionIds = [...new Set(solutions.map((s: any) => s.question_id))];

    const { data: validQuestions, error: qErr } = await supabase
      .from("exam_questions")
      .select("id")
      .in("id", questionIds);

    if (qErr) throw qErr;

    const validIds = new Set(validQuestions?.map((q: any) => q.id) ?? []);
    const orphans = questionIds.filter((id) => !validIds.has(id));

    if (orphans.length > 0) {
      return {
        name,
        pass: false,
        detail: `${orphans.length} orphan solutions (question_ids: ${orphans.slice(0, 3).join(", ")}${orphans.length > 3 ? "…" : ""})`,
      };
    }

    return {
      name,
      pass: true,
      detail: `${solutions.length} solutions, all have valid exam_questions`,
    };
  } catch (e: any) {
    return { name, pass: false, detail: e.message };
  }
}

async function checkNoOrphanAnalytics(): Promise<CheckResult> {
  const name = "No orphan analytics";
  try {
    const { data: analytics, error: aErr } = await supabase
      .from("question_analytics")
      .select("question_id");

    if (aErr) throw aErr;
    if (!analytics || analytics.length === 0) {
      return { name, pass: true, detail: "0 question_analytics rows, 0 orphans" };
    }

    const questionIds = [...new Set(analytics.map((a: any) => a.question_id))];

    const { data: validQuestions, error: qErr } = await supabase
      .from("exam_questions")
      .select("id")
      .in("id", questionIds);

    if (qErr) throw qErr;

    const validIds = new Set(validQuestions?.map((q: any) => q.id) ?? []);
    const orphans = questionIds.filter((id) => !validIds.has(id));

    if (orphans.length > 0) {
      return {
        name,
        pass: false,
        detail: `${orphans.length} orphan question_analytics rows`,
      };
    }

    return {
      name,
      pass: true,
      detail: `${analytics.length} question_analytics rows, all have valid exam_questions`,
    };
  } catch (e: any) {
    return { name, pass: false, detail: e.message };
  }
}

async function checkInstituteGeminiKey(): Promise<CheckResult> {
  const name = "Institute Gemini key (live decrypt)";

  if (!defaultInstituteId) {
    return {
      name,
      pass: false,
      detail: "NEXT_PUBLIC_DEFAULT_INSTITUTE_ID not set in .env.local",
    };
  }

  try {
    const key = await getInstituteGeminiKey(defaultInstituteId);
    if (!key || key.length < 10) {
      return { name, pass: false, detail: "Key decrypted but appears invalid (too short)" };
    }
    // Show only a prefix for security
    const preview = key.substring(0, 8) + "…" + key.substring(key.length - 4);
    return {
      name,
      pass: true,
      detail: `Key decrypted successfully for institute ${defaultInstituteId} (${preview})`,
    };
  } catch (e: any) {
    const code = e.name || "UNKNOWN";
    if (code === "NO_KEY") {
      return {
        name,
        pass: false,
        detail: `No Gemini API key stored for institute ${defaultInstituteId}. Add one via the Institute Settings UI.`,
      };
    }
    if (code === "INVALID_SECRET") {
      return {
        name,
        pass: false,
        detail: `Key exists but failed to decrypt. API_KEY_ENCRYPTION_SECRET mismatch?`,
      };
    }
    return { name, pass: false, detail: e.message };
  }
}

// ── Runner ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║     ExamGrid Demo Readiness Check        ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("");

  const checks: CheckResult[] = await Promise.all([
    checkMigrationsApplied(),
    checkWorkerUnlocked(),
    checkQueueEmpty(),
    checkAnalyticsEmpty(),
    checkNoOrphanSolutions(),
    checkNoOrphanAnalytics(),
    checkInstituteGeminiKey(),
  ]);

  // ── Print table ─────────────────────────────────────────────────
  const nameWidth = Math.max(...checks.map((c) => c.name.length), 28);
  const sep = "─".repeat(nameWidth + 2 + 8 + 2 + 60);

  console.log(sep);
  console.log(
    `  ${"Check".padEnd(nameWidth)}  ${"Status".padEnd(8)}  Detail`
  );
  console.log(sep);

  let allPassed = true;
  for (const check of checks) {
    const icon = check.pass ? "✅ PASS" : "❌ FAIL";
    if (!check.pass) allPassed = false;
    console.log(
      `  ${check.name.padEnd(nameWidth)}  ${icon.padEnd(8)}  ${check.detail}`
    );
  }

  console.log(sep);
  console.log("");

  if (allPassed) {
    console.log("🎉  All checks passed — system is DEMO-READY.");
    console.log("");
    process.exit(0);
  } else {
    const failed = checks.filter((c) => !c.pass).length;
    console.log(`⚠️   ${failed} check(s) failed — system is NOT demo-ready.`);
    console.log("");
    console.log("Remediation hints:");
    for (const check of checks.filter((c) => !c.pass)) {
      console.log(`  • ${check.name}: ${check.detail}`);
    }
    console.log("");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
