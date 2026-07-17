/**
 * Regenerate Solutions Script
 *
 * Re-queues existing solutions for regeneration with a specified prompt version.
 * Existing solutions are deactivated (is_active = false) and new generation jobs
 * are enqueued so the worker picks them up.
 *
 * Usage:
 *   npm run regenerate:solutions                    # Regenerate all non-V3 solutions
 *   npm run regenerate:solutions -- --prompt=v3     # Explicit prompt version
 *   npm run regenerate:solutions -- --dry-run       # Preview without making changes
 *   npm run regenerate:solutions -- --limit=50      # Limit number of questions
 *   npm run regenerate:solutions -- --institute=ID  # Filter by institute
 *
 * Safety:
 *   - Does NOT delete existing solutions (only deactivates them)
 *   - Respects queue idempotency (won't double-enqueue)
 *   - Dry-run mode for previewing
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERROR: Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ─── CLI Args ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (name: string): string | undefined => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1] : undefined;
};
const hasFlag = (name: string) => args.includes(`--${name}`);

const targetPrompt = getArg("prompt") || "solution-v3";
const dryRun = hasFlag("dry-run");
const limit = parseInt(getArg("limit") || "0", 10);
const instituteFilter = getArg("institute");

async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  ExamGrid Solution Regeneration Script");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Target prompt:  ${targetPrompt}`);
  console.log(`  Dry run:        ${dryRun ? "YES" : "NO"}`);
  console.log(`  Limit:          ${limit || "unlimited"}`);
  console.log(`  Institute:      ${instituteFilter || "all"}`);
  console.log("───────────────────────────────────────────────────\n");

  // 1. Find solutions that are NOT generated with the target prompt version
  let query = supabase
    .from("question_solutions")
    .select("id, question_id, institute_id, prompt_version, version, is_active")
    .eq("is_active", true)
    .neq("prompt_version", targetPrompt);

  if (instituteFilter) {
    query = query.eq("institute_id", instituteFilter);
  }

  if (limit > 0) {
    query = query.limit(limit);
  }

  const { data: solutions, error } = await query;

  if (error) {
    console.error("ERROR fetching solutions:", error.message);
    process.exit(1);
  }

  if (!solutions || solutions.length === 0) {
    console.log("✅ No solutions need regeneration. All active solutions use the target prompt.");
    process.exit(0);
  }

  console.log(`Found ${solutions.length} solutions using non-${targetPrompt} prompts.\n`);

  // Group by prompt version for reporting
  const byVersion: Record<string, number> = {};
  for (const sol of solutions) {
    const v = sol.prompt_version || "unknown";
    byVersion[v] = (byVersion[v] || 0) + 1;
  }
  console.log("Breakdown by current prompt version:");
  for (const [version, count] of Object.entries(byVersion)) {
    console.log(`  ${version}: ${count} solutions`);
  }
  console.log("");

  if (dryRun) {
    console.log("DRY RUN — no changes made. Remove --dry-run to execute.\n");
    console.log("Questions that would be regenerated:");
    for (const sol of solutions.slice(0, 20)) {
      console.log(`  Q: ${sol.question_id} (institute: ${sol.institute_id}, current: ${sol.prompt_version})`);
    }
    if (solutions.length > 20) {
      console.log(`  ... and ${solutions.length - 20} more.`);
    }
    process.exit(0);
  }

  // 2. Deactivate existing solutions
  console.log("Step 1: Deactivating existing solutions...");
  const solutionIds = solutions.map((s) => s.id);
  
  // Batch in groups of 100
  for (let i = 0; i < solutionIds.length; i += 100) {
    const batch = solutionIds.slice(i, i + 100);
    const { error: deactivateErr } = await supabase
      .from("question_solutions")
      .update({ is_active: false })
      .in("id", batch);

    if (deactivateErr) {
      console.error(`ERROR deactivating batch ${i}-${i + batch.length}:`, deactivateErr.message);
      process.exit(1);
    }
    console.log(`  Deactivated ${Math.min(i + 100, solutionIds.length)}/${solutionIds.length}`);
  }

  // 3. Enqueue for regeneration
  console.log("\nStep 2: Enqueuing for regeneration...");
  const questionIds = [...new Set(solutions.map((s) => s.question_id))];
  
  // Group by institute for proper queue entries
  const byInstitute = new Map<string, string[]>();
  for (const sol of solutions) {
    const existing = byInstitute.get(sol.institute_id) || [];
    if (!existing.includes(sol.question_id)) {
      existing.push(sol.question_id);
    }
    byInstitute.set(sol.institute_id, existing);
  }

  let totalEnqueued = 0;
  let totalSkipped = 0;

  for (const [instituteId, qIds] of byInstitute.entries()) {
    // Filter out questions already in queue
    const { data: queued } = await supabase
      .from("solution_generation_queue")
      .select("question_id")
      .in("question_id", qIds)
      .in("status", ["PENDING", "PROCESSING", "WAITING_RETRY"]);

    const queuedSet = new Set(queued?.map((q: any) => q.question_id) || []);
    const toEnqueue = qIds.filter((id) => !queuedSet.has(id));

    if (toEnqueue.length === 0) {
      totalSkipped += qIds.length;
      continue;
    }

    // Batch insert
    for (let i = 0; i < toEnqueue.length; i += 100) {
      const batch = toEnqueue.slice(i, i + 100);
      const { data: inserted, error: insertErr } = await supabase
        .from("solution_generation_queue")
        .insert(
          batch.map((qId) => ({
            question_id: qId,
            institute_id: instituteId,
            priority: 50, // Lower priority than fresh generation
            status: "PENDING",
          }))
        )
        .select("id");

      if (insertErr) {
        if (insertErr.code === "23505") {
          console.warn(`  Skipped duplicate queue entries for institute ${instituteId}`);
          totalSkipped += batch.length;
        } else {
          console.error(`  ERROR enqueuing batch:`, insertErr.message);
        }
      } else {
        totalEnqueued += inserted?.length || 0;
      }
    }

    console.log(`  Institute ${instituteId}: enqueued ${toEnqueue.length} questions`);
  }

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Regeneration Summary");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Solutions deactivated:    ${solutionIds.length}`);
  console.log(`  Questions enqueued:       ${totalEnqueued}`);
  console.log(`  Questions skipped (dupe): ${totalSkipped}`);
  console.log(`  Unique questions:         ${questionIds.length}`);
  console.log("───────────────────────────────────────────────────");
  console.log("\nThe solution worker will pick up these jobs automatically.");
  console.log("Monitor progress: npm run queue:status\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
