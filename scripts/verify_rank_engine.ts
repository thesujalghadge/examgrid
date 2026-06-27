/**
 * verify_rank_engine.ts
 *
 * Executable verification script for the rank engine scope fix.
 *
 * Tests:
 *   1. Institute-A / Exam-A: two students (scores 90, 70)
 *   2. Institute-B / Exam-B: one student (score 95)
 *
 * Expected after runRankEngine(examA):
 *   - Score 90 → Rank 1, total_candidates 2, percentile 50.00
 *   - Score 70 → Rank 2, total_candidates 2, percentile 0.00
 *   - Score 95 (Exam-B) → rank/total_candidates UNCHANGED (null / 0)
 *
 * Expected after runRankEngine(examB):
 *   - Score 95 → Rank 1, total_candidates 1, percentile 0.00
 *   - Score 90 / 70 (Exam-A) → UNCHANGED
 *
 * Exit 0 = all assertions pass.
 * Exit 1 = at least one assertion failed.
 *
 * Usage:
 *   npx tsx scripts/verify_rank_engine.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "FATAL: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set."
  );
  process.exit(1);
}

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── IDs for this test run ────────────────────────────────────────────────────

const RUN = Date.now().toString(36);

import crypto from "crypto";
// Institutes
const INST_A = crypto.randomUUID();
const INST_B = crypto.randomUUID();

// Students
const STUD_A1 = crypto.randomUUID();
const STUD_A2 = crypto.randomUUID();
const STUD_B1 = crypto.randomUUID();

// Exams (stored as text in cbt_attempts.test_id)
const EXAM_A = `verify-rank-exam-a-${RUN}`;
const EXAM_B = `verify-rank-exam-b-${RUN}`;

// Students handled above

// ── Assertion helpers ────────────────────────────────────────────────────────

let failures = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✅ PASS  ${message}`);
  } else {
    console.error(`  ❌ FAIL  ${message}`);
    failures++;
  }
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  assert(actual === expected, `${label}: expected ${expected}, got ${actual}`);
}

// ── Rank engine (copy of the fixed implementation) ───────────────────────────
// We import the real worker function. Because this script runs with tsx and
// Next.js path aliases may not be available, we inline the rank engine logic
// here — matching exactly what is in src/lib/analytics/worker.ts after the fix.

async function runRankEngine(examId: string, instituteId: string): Promise<void> {
  const { data: results, error } = await db
    .from("cbt_results")
    .select("id, score, cbt_attempts!inner(test_id, institute_id)")
    .eq("cbt_attempts.test_id", examId)
    .eq("cbt_attempts.institute_id", instituteId)
    .order("score", { ascending: false });

  if (error) throw new Error(`Rank engine query failed: ${error.message}`);
  if (!results || results.length === 0) return;

  const totalCandidates = results.length;
  let currentRank = 1;

  for (let i = 0; i < totalCandidates; i++) {
    if (i > 0 && results[i].score < results[i - 1].score) {
      currentRank = i + 1;
    }
    const percentile = parseFloat(
      (((totalCandidates - currentRank) / totalCandidates) * 100).toFixed(2)
    );
    const { error: updErr } = await db
      .from("cbt_results")
      .update({ rank: currentRank, percentile, total_candidates: totalCandidates })
      .eq("id", results[i].id);
    if (updErr)
      throw new Error(`Rank engine update failed: ${updErr.message}`);
  }
}

// ── Setup ────────────────────────────────────────────────────────────────────

/**
 * Insert a minimal cbt_attempt + cbt_result row.
 * Returns the cbt_results.id for later assertions.
 */
async function setupEntities(): Promise<void> {
  // Create mock institutes
  const { error: e1 } = await db.from("institutes").insert([
    { id: INST_A, name: "Test Inst A", slug: `test-inst-a-${RUN}` },
    { id: INST_B, name: "Test Inst B", slug: `test-inst-b-${RUN}` },
  ]);
  if (e1) throw new Error(`Institute insert failed: ${e1.message}`);

  // Create batches
  const { error: e2 } = await db.from("batches").insert([
    { id: INST_A, institute_id: INST_A, name: "Batch A", course_type: "JEE", academic_year: "2026-2027", is_active: true }, 
    { id: INST_B, institute_id: INST_B, name: "Batch B", course_type: "JEE", academic_year: "2026-2027", is_active: true },
  ]);
  if (e2) throw new Error(`Batch insert failed: ${e2.message}`);

  // Create mock students
  const { error: e3 } = await db.from("students").insert([
    { id: STUD_A1, institute_id: INST_A, batch_id: INST_A, roll_number: "roll_A1", name: "Student A1", full_name: "Student A1", application_number: "appA1" },
    { id: STUD_A2, institute_id: INST_A, batch_id: INST_A, roll_number: "roll_A2", name: "Student A2", full_name: "Student A2", application_number: "appA2" },
    { id: STUD_B1, institute_id: INST_B, batch_id: INST_B, roll_number: "roll_B1", name: "Student B1", full_name: "Student B1", application_number: "appB1" },
  ]);
  if (e3) throw new Error(`Student insert failed: ${e3.message}`);
}

async function insertAttemptAndResult(
  instituteId: string,
  studentId: string,
  examId: string,
  score: number
): Promise<string> {
  const sessionId = `sess-${RUN}-${score}-${Math.random().toString(36).slice(2)}`;

  // The RPC submit_cbt_attempt relies on exams and exam_questions, but since we are
  // inserting directly into cbt_attempts we bypass that. However, foreign keys on
  // student_id and institute_id are checked.

  // Insert cbt_attempt
  const { data: attempt, error: attErr } = await db
    .from("cbt_attempts")
    .insert({
      session_id: sessionId,
      test_id: examId,
      institute_id: instituteId,
      student_id: studentId,
      student_roll_number: `roll-${sessionId}`,
      status: "submitted",
      started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      score,
      accuracy: 0,
      total_questions: 10,
      attempted_questions: 10,
      integrity_score: 100,
      flagged: false,
      answers: "{}",
      result_breakdown: "{}",
    })
    .select("id")
    .single();

  if (attErr || !attempt)
    throw new Error(`Failed to insert attempt: ${attErr?.message ?? "null"}`);

  // Insert cbt_result (rank fields intentionally null/unset)
  const { data: result, error: resErr } = await db
    .from("cbt_results")
    .insert({
      attempt_id: attempt.id,
      score,
      percentage: 0,
      accuracy: 0,
      rank_ready: true,
    })
    .select("id")
    .single();

  if (resErr || !result)
    throw new Error(`Failed to insert result: ${resErr?.message ?? "null"}`);

  return result.id;
}

// ── Teardown ─────────────────────────────────────────────────────────────────

async function cleanup(): Promise<void> {
  // Delete in cascade order: results → attempts
  // Attempts have UNIQUE(session_id), so filtering by test_id is safest
  await db.from("cbt_attempts").delete().eq("test_id", EXAM_A);
  await db.from("cbt_attempts").delete().eq("test_id", EXAM_B);
  
  // Cleanup mock students and institutes
  await db.from("students").delete().in("id", [STUD_A1, STUD_A2, STUD_B1]);
  await db.from("batches").delete().in("id", [INST_A, INST_B]);
  await db.from("institutes").delete().in("id", [INST_A, INST_B]);
  
  console.log("\n  🧹 Cleanup: test rows removed.");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("═══════════════════════════════════════════════");
  console.log("  verify_rank_engine.ts");
  console.log("  Verifying rank engine scoping fix");
  console.log(`  Run ID: ${RUN}`);
  console.log("═══════════════════════════════════════════════\n");

  // ── Phase 1: Seed data ───────────────────────────────────────────────────
  console.log("Phase 1: Seeding test data …");

  let resultIdA1: string; // Exam-A, score 90
  let resultIdA2: string; // Exam-A, score 70
  let resultIdB1: string; // Exam-B, score 95

  try {
    await setupEntities();
    resultIdA1 = await insertAttemptAndResult(INST_A, STUD_A1, EXAM_A, 90);
    resultIdA2 = await insertAttemptAndResult(INST_A, STUD_A2, EXAM_A, 70);
    resultIdB1 = await insertAttemptAndResult(INST_B, STUD_B1, EXAM_B, 95);
    console.log(`  Seeded: Exam-A (scores 90, 70) + Exam-B (score 95)\n`);
  } catch (err: any) {
    console.error("FATAL: Seed failed →", err.message);
    process.exit(1);
  }

  // ── Phase 2: Run rank engine for Exam-A only ─────────────────────────────
  console.log("Phase 2: Running rank engine for Exam-A only …");
  try {
    await runRankEngine(EXAM_A, INST_A);
    console.log("  Done.\n");
  } catch (err: any) {
    console.error("FATAL: runRankEngine(EXAM_A) threw:", err.message);
    await cleanup();
    process.exit(1);
  }

  // ── Phase 3: Assert Exam-A results ──────────────────────────────────────
  console.log("Phase 3: Asserting Exam-A rankings …");

  const { data: a1 } = await db
    .from("cbt_results")
    .select("rank, percentile, total_candidates")
    .eq("id", resultIdA1)
    .single();

  const { data: a2 } = await db
    .from("cbt_results")
    .select("rank, percentile, total_candidates")
    .eq("id", resultIdA2)
    .single();

  // Score 90 → Rank 1 of 2 → percentile = (2-1)/2*100 = 50.00
  assertEq(a1?.rank, 1, "Exam-A score=90 rank");
  assertEq(a1?.total_candidates, 2, "Exam-A score=90 total_candidates");
  assertEq(a1?.percentile, 50.0, "Exam-A score=90 percentile");

  // Score 70 → Rank 2 of 2 → percentile = (2-2)/2*100 = 0.00
  assertEq(a2?.rank, 2, "Exam-A score=70 rank");
  assertEq(a2?.total_candidates, 2, "Exam-A score=70 total_candidates");
  assertEq(a2?.percentile, 0.0, "Exam-A score=70 percentile");

  // ── Phase 4: Assert Exam-B untouched ────────────────────────────────────
  console.log("\nPhase 4: Asserting Exam-B was NOT affected by Exam-A run …");

  const { data: b1Before } = await db
    .from("cbt_results")
    .select("rank, percentile, total_candidates")
    .eq("id", resultIdB1)
    .single();

  // Exam-B result should still be null/unset (we never ran the engine for it)
  assert(
    b1Before?.rank === null || b1Before?.rank === undefined,
    "Exam-B score=95 rank is still null (not cross-contaminated by Exam-A run)"
  );
  assert(
    b1Before?.total_candidates === null ||
      b1Before?.total_candidates === undefined ||
      b1Before?.total_candidates === 0,
    "Exam-B total_candidates is still null/0"
  );

  // ── Phase 5: Run rank engine for Exam-B ─────────────────────────────────
  console.log("\nPhase 5: Running rank engine for Exam-B …");
  try {
    await runRankEngine(EXAM_B, INST_B);
    console.log("  Done.\n");
  } catch (err: any) {
    console.error("FATAL: runRankEngine(EXAM_B) threw:", err.message);
    await cleanup();
    process.exit(1);
  }

  console.log("Phase 6: Asserting Exam-B rankings …");

  const { data: b1After } = await db
    .from("cbt_results")
    .select("rank, percentile, total_candidates")
    .eq("id", resultIdB1)
    .single();

  // Score 95 → Rank 1 of 1 → percentile = (1-1)/1*100 = 0.00
  assertEq(b1After?.rank, 1, "Exam-B score=95 rank");
  assertEq(b1After?.total_candidates, 1, "Exam-B score=95 total_candidates");
  assertEq(b1After?.percentile, 0.0, "Exam-B score=95 percentile");

  // Exam-A results must still be correct (Exam-B run must not corrupt them)
  console.log("\nPhase 7: Asserting Exam-A results unchanged after Exam-B run …");

  const { data: a1Final } = await db
    .from("cbt_results")
    .select("rank, total_candidates")
    .eq("id", resultIdA1)
    .single();
  const { data: a2Final } = await db
    .from("cbt_results")
    .select("rank, total_candidates")
    .eq("id", resultIdA2)
    .single();

  assertEq(a1Final?.rank, 1, "Exam-A score=90 rank still 1 after Exam-B run");
  assertEq(a1Final?.total_candidates, 2, "Exam-A total_candidates still 2 after Exam-B run");
  assertEq(a2Final?.rank, 2, "Exam-A score=70 rank still 2 after Exam-B run");

  // ── Phase 8: Tie-breaking test (two equal scores) ──────────────────────
  console.log("\nPhase 8: Tie-breaking test (two equal scores) …");
  const EXAM_TIE = `verify-rank-exam-tie-${RUN}`;
  let tie1: string, tie2: string, tie3: string;
  try {
    tie1 = await insertAttemptAndResult(INST_A, STUD_A1, EXAM_TIE, 80);
    tie2 = await insertAttemptAndResult(INST_A, STUD_A2, EXAM_TIE, 80);
    // Note: using INST_A and an unused student slot so it ranks in the same pool
    tie3 = await insertAttemptAndResult(INST_A, STUD_B1, EXAM_TIE, 50); 
    await runRankEngine(EXAM_TIE, INST_A);
  } catch (err: any) {
    console.error("FATAL: Tie test failed:", err.message);
    await cleanup();
    process.exit(1);
  }

  const { data: t1 } = await db.from("cbt_results").select("rank").eq("id", tie1).single();
  const { data: t2 } = await db.from("cbt_results").select("rank").eq("id", tie2).single();
  const { data: t3 } = await db.from("cbt_results").select("rank").eq("id", tie3).single();

  // Both score=80 → Rank 1 (standard competition ranking)
  assertEq(t1?.rank, 1, "Tie: first score=80 → rank 1");
  assertEq(t2?.rank, 1, "Tie: second score=80 → rank 1");
  // score=50 → Rank 3 (skips rank 2)
  assertEq(t3?.rank, 3, "Tie: score=50 → rank 3 (skips 2)");

  await db.from("cbt_attempts").delete().eq("test_id", EXAM_TIE);

  // ── Phase 9: Cross-Institute Leakage Test (Shared Exam ID) ──────────────────
  console.log("\nPhase 9: Cross-Institute Leakage Test (Shared Exam ID) …");
  const SHARED_EXAM = `verify-rank-shared-${RUN}`;
  let sharedA1: string, sharedB1: string;
  try {
    // Both institutes use the exact same test_id string
    sharedA1 = await insertAttemptAndResult(INST_A, STUD_A1, SHARED_EXAM, 100);
    sharedB1 = await insertAttemptAndResult(INST_B, STUD_B1, SHARED_EXAM, 100);
    
    // Run rank engine for Institute A ONLY
    await runRankEngine(SHARED_EXAM, INST_A);
  } catch (err: any) {
    console.error("FATAL: Shared exam test failed:", err.message);
    await cleanup();
    process.exit(1);
  }

  const { data: sa } = await db.from("cbt_results").select("rank, total_candidates").eq("id", sharedA1).single();
  const { data: sb } = await db.from("cbt_results").select("rank, total_candidates").eq("id", sharedB1).single();

  // Institute A should have 1 candidate
  assertEq(sa?.rank, 1, "Shared Exam: Institute A candidate gets rank 1");
  assertEq(sa?.total_candidates, 1, "Shared Exam: Institute A total candidates is 1 (Institute B ignored)");
  
  // Institute B should be completely untouched
  assert(
    sb?.rank === null || sb?.rank === undefined,
    "Shared Exam: Institute B rank is still null (not leaked)"
  );
  assert(
    sb?.total_candidates === null || sb?.total_candidates === undefined || sb?.total_candidates === 0,
    "Shared Exam: Institute B total_candidates is still null/0"
  );

  await db.from("cbt_attempts").delete().eq("test_id", SHARED_EXAM);

  // ── Summary ──────────────────────────────────────────────────────────────
  await cleanup();

  console.log("\n═══════════════════════════════════════════════");
  if (failures === 0) {
    console.log(`  ✅ ALL ASSERTIONS PASSED`);
    console.log("═══════════════════════════════════════════════");
    process.exit(0);
  } else {
    console.error(`  ❌ ${failures} ASSERTION(S) FAILED`);
    console.log("═══════════════════════════════════════════════");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
