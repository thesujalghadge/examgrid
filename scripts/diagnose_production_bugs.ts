/**
 * ExamGrid Production Diagnostics
 * Run: npx tsx scripts/diagnose_production_bugs.ts
 */
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SEP = "─".repeat(70);

function section(title: string) {
  console.log("\n" + SEP);
  console.log(`  ${title}`);
  console.log(SEP);
}

async function main() {
  console.log("\n🔍 ExamGrid Production Diagnostics");
  console.log(`   ${new Date().toISOString()}\n`);

  // ─────────────────────────────────────────────────────────
  // 1. SOLUTION GENERATION QUEUE STATUS
  // ─────────────────────────────────────────────────────────
  section("1. SOLUTION GENERATION QUEUE STATUS");
  const { data: queueCounts, error: qcErr } = await supabase
    .rpc("query_solution_queue_status")
    .select("*")
    .limit(20);

  // Fallback: direct query
  const { data: queueRows, error: queueErr } = await supabase
    .from("solution_generation_queue")
    .select("status, failure_stage, last_error, attempts, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (queueErr) {
    console.error("  ❌ Queue query error:", queueErr.message);
  } else if (!queueRows || queueRows.length === 0) {
    console.log("  ⚠️  solution_generation_queue is EMPTY — no jobs ever inserted");
    console.log("     This means the publish flow never called enqueueSolutionsForExam()");
  } else {
    // Aggregate by status
    const statusMap: Record<string, number> = {};
    const stageMap: Record<string, number> = {};
    for (const row of queueRows) {
      statusMap[row.status] = (statusMap[row.status] || 0) + 1;
      if (row.failure_stage) {
        stageMap[row.failure_stage] = (stageMap[row.failure_stage] || 0) + 1;
      }
    }
    console.log("  Status breakdown:");
    for (const [status, count] of Object.entries(statusMap)) {
      const icon = status === "COMPLETED" ? "✅" : status === "FAILED" ? "❌" : status === "PENDING" ? "⏳" : "🔄";
      console.log(`    ${icon}  ${status}: ${count}`);
    }
    if (Object.keys(stageMap).length > 0) {
      console.log("\n  Failure stages:");
      for (const [stage, count] of Object.entries(stageMap)) {
        console.log(`    ❌  ${stage}: ${count}`);
      }
    }
    // Show sample errors
    const failed = queueRows.filter(r => r.status === "FAILED" || r.status === "WAITING_RETRY");
    if (failed.length > 0) {
      console.log(`\n  Sample errors (first 5 of ${failed.length} failed):`);
      for (const f of failed.slice(0, 5)) {
        console.log(`    attempts=${f.attempts} stage=${f.failure_stage}`);
        console.log(`    error: ${(f.last_error || "").substring(0, 120)}`);
        console.log();
      }
    }
    const pending = queueRows.filter(r => r.status === "PENDING");
    if (pending.length > 0) {
      console.log(`\n  ⏳ ${pending.length} PENDING jobs sitting unprocessed`);
      console.log(`     Oldest: ${pending[pending.length - 1]?.created_at}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 2. LATEST CBT ATTEMPTS — find the two student submissions
  // ─────────────────────────────────────────────────────────
  section("2. LATEST CBT ATTEMPTS");
  const { data: attempts, error: attErr } = await supabase
    .from("cbt_attempts")
    .select("id, session_id, test_id, student_roll_number, score, status, submitted_at, result_breakdown, total_questions, attempted_questions")
    .order("submitted_at", { ascending: false })
    .limit(10);

  if (attErr) {
    console.error("  ❌ Attempts query error:", attErr.message);
  } else if (!attempts || attempts.length === 0) {
    console.log("  ⚠️  No CBT attempts found in database");
  } else {
    for (const a of attempts) {
      const rb = a.result_breakdown as any;
      console.log(`\n  Attempt: ${a.id}`);
      console.log(`    Student:  ${a.student_roll_number}`);
      console.log(`    Score:    ${a.score}`);
      console.log(`    Status:   ${a.status}`);
      console.log(`    Submitted: ${a.submitted_at}`);
      if (rb) {
        console.log(`    Breakdown: correct=${rb.correct} incorrect=${rb.incorrect} unattempted=${rb.unattempted}`);
        console.log(`    rawScore=${rb.rawScore} finalScore=${rb.finalScore} maxScore=${rb.maxScore}`);
        console.log(`    integrityPenalty=${rb.integrityPenalty}`);
        if (rb.perQuestion) {
          console.log(`    perQuestion entries: ${rb.perQuestion.length}`);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // 3. PER-QUESTION ANSWER DETAIL FOR LAST 2 ATTEMPTS
  // ─────────────────────────────────────────────────────────
  section("3. PER-QUESTION ANSWER DETAIL (last 2 attempts)");
  if (attempts && attempts.length > 0) {
    for (const attempt of attempts.slice(0, 2)) {
      console.log(`\n  === Attempt ${attempt.id} (${attempt.student_roll_number}) ===`);
      console.log(`  Stored score in DB: ${attempt.score}`);

      const { data: answers, error: ansErr } = await supabase
        .from("cbt_attempt_answers")
        .select("question_id, selected_answer, is_correct, marks_awarded")
        .eq("attempt_id", attempt.id)
        .order("question_id");

      if (ansErr) {
        console.error(`    ❌ Error: ${ansErr.message}`);
        continue;
      }

      if (!answers || answers.length === 0) {
        console.log("    ⚠️  No answer rows in cbt_attempt_answers");
        continue;
      }

      // Check for duplicates
      const qIdCounts: Record<string, number> = {};
      for (const a of answers) {
        qIdCounts[a.question_id] = (qIdCounts[a.question_id] || 0) + 1;
      }
      const dups = Object.entries(qIdCounts).filter(([, c]) => c > 1);
      if (dups.length > 0) {
        console.log(`\n  🚨 DUPLICATE question_ids found: ${dups.length} questions have multiple rows!`);
        for (const [qid, count] of dups) {
          console.log(`     ${qid}: ${count} rows`);
        }
      } else {
        console.log(`  ✅ No duplicate question_id entries (${answers.length} unique questions)`);
      }

      // Score from DB answers
      let totalFromDb = 0;
      let correctCount = 0;
      let incorrectCount = 0;
      let unattemptedCount = 0;
      for (const a of answers) {
        totalFromDb += Number(a.marks_awarded);
        if (a.selected_answer === null) unattemptedCount++;
        else if (a.is_correct) correctCount++;
        else incorrectCount++;
      }

      console.log(`\n  Score recomputed from cbt_attempt_answers:`);
      console.log(`    correct=${correctCount} incorrect=${incorrectCount} unattempted=${unattemptedCount}`);
      console.log(`    sum(marks_awarded) = ${totalFromDb}`);
      console.log(`    stored score       = ${attempt.score}`);
      if (Math.abs(totalFromDb - Number(attempt.score)) > 0.01) {
        console.log(`  🚨 MISMATCH: DB answer sum (${totalFromDb}) ≠ stored score (${attempt.score})`);
      } else {
        console.log(`  ✅ Stored score matches sum of marks_awarded`);
      }

      // Show marks distribution
      const marksGroups: Record<string, number> = {};
      for (const a of answers) {
        const m = String(a.marks_awarded);
        marksGroups[m] = (marksGroups[m] || 0) + 1;
      }
      console.log(`\n  marks_awarded distribution:`);
      for (const [marks, count] of Object.entries(marksGroups).sort()) {
        console.log(`    ${marks}: ${count} questions`);
      }

      // Show suspicious marks (not 0, 4, or -1)
      const suspicious = answers.filter(a => {
        const m = Number(a.marks_awarded);
        return m !== 0 && m !== 4 && m !== -1 && m !== 1 && m !== -0.33;
      });
      if (suspicious.length > 0) {
        console.log(`\n  🚨 SUSPICIOUS marks_awarded values (not 0/4/-1):`);
        for (const s of suspicious.slice(0, 10)) {
          console.log(`    qid=${s.question_id.substring(0, 30)}... awarded=${s.marks_awarded} correct=${s.is_correct} answer=${s.selected_answer}`);
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────
  // 4. EXAM QUESTIONS MARKS CHECK
  // ─────────────────────────────────────────────────────────
  section("4. EXAM QUESTIONS — marks / negative_marks check");
  if (attempts && attempts.length > 0) {
    const testId = attempts[0].test_id;
    console.log(`  Using test_id: ${testId}`);

    const { data: examData, error: examErr } = await supabase
      .from("exams")
      .select("id, legacy_id, title")
      .or(`id.eq.${testId},legacy_id.eq.${testId}`)
      .maybeSingle();

    if (examData) {
      const examUuid = examData.id;
      console.log(`  Exam: "${examData.title}" (uuid: ${examUuid})`);

      const { data: examQs, error: eqErr } = await supabase
        .from("exam_questions")
        .select("id, question_number, question_type, marks, negative_marks, correct_option_id, correct_numerical_answer")
        .eq("exam_id", examUuid)
        .order("question_number")
        .limit(20);

      if (eqErr) {
        console.error(`  ❌ exam_questions error: ${eqErr.message}`);
      } else if (!examQs || examQs.length === 0) {
        console.log("  ⚠️  No exam_questions rows found for this exam UUID");
        console.log("     The exam may be loaded from a different source (legacy/local)");
      } else {
        console.log(`\n  Total rows: ${examQs.length}`);
        // marks distribution
        const marksSet = new Set(examQs.map(q => `${q.marks}/${q.negative_marks}`));
        console.log(`  marks/negative_marks combos: ${[...marksSet].join(", ")}`);

        const zeroMarks = examQs.filter(q => Number(q.marks) === 0);
        if (zeroMarks.length > 0) {
          console.log(`  🚨 ${zeroMarks.length} questions have marks=0`);
        } else {
          console.log(`  ✅ No questions have marks=0`);
        }

        const zeroNeg = examQs.filter(q => Number(q.negative_marks) === 0 && q.question_type !== "NUMERICAL");
        if (zeroNeg.length > 0) {
          console.log(`  ⚠️  ${zeroNeg.length} non-NUMERICAL questions have negative_marks=0`);
        }

        const missingAnswer = examQs.filter(q =>
          !q.correct_option_id && !q.correct_numerical_answer
        );
        if (missingAnswer.length > 0) {
          console.log(`  🚨 ${missingAnswer.length} questions have NO correct answer in DB`);
        } else {
          console.log(`  ✅ All questions have a correct answer key`);
        }

        console.log("\n  First 10 questions:");
        console.log("  Q#  | Type       | marks | neg | correct_option");
        console.log("  ----|------------|-------|-----|---------------");
        for (const q of examQs.slice(0, 10)) {
          const ans = q.correct_option_id || q.correct_numerical_answer || "(none)";
          console.log(
            `  ${String(q.question_number).padEnd(4)}| ${String(q.question_type).padEnd(10)} | ${String(q.marks).padEnd(5)} | ${String(q.negative_marks).padEnd(3)} | ${ans.substring(0, 30)}`
          );
        }
      }
    } else {
      console.log(`  ⚠️  Could not find exam row for test_id: ${testId}`);
    }
  }

  // ─────────────────────────────────────────────────────────
  // 5. DUPLICATE UNIQUE CONSTRAINT CHECK
  // ─────────────────────────────────────────────────────────
  section("5. cbt_attempt_answers UNIQUE CONSTRAINT CHECK");
  const { data: dupCheck, error: dupErr } = await supabase
    .from("cbt_attempt_answers")
    .select("attempt_id, question_id")
    .order("attempt_id");

  if (!dupErr && dupCheck) {
    const seen = new Map<string, number>();
    let dupCount = 0;
    for (const row of dupCheck) {
      const key = `${row.attempt_id}:${row.question_id}`;
      seen.set(key, (seen.get(key) || 0) + 1);
      if ((seen.get(key) || 0) > 1) dupCount++;
    }
    if (dupCount > 0) {
      console.log(`  🚨 FOUND ${dupCount} DUPLICATE (attempt_id, question_id) pairs!`);
      console.log("     This EXPLAINS the -87 score — same question counted multiple times");
    } else {
      console.log(`  ✅ No duplicate (attempt_id, question_id) pairs found (${dupCheck.length} total rows)`);
    }
  }

  console.log("\n" + SEP);
  console.log("  Diagnostics complete");
  console.log(SEP + "\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
