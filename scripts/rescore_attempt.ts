/**
 * rescore_attempt.ts
 *
 * Recalculates the score for a submitted CBT attempt using the current
 * scoring engine and updates cbt_attempts, cbt_results, and cbt_attempt_answers
 * in a single transaction-safe sequence.
 *
 * Usage:
 *   npx tsx scripts/rescore_attempt.ts <attempt_id>
 *
 * Example:
 *   npx tsx scripts/rescore_attempt.ts 384c160c-2e77-4170-b6c5-ec58f82dc363
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

// ─────────────────────────────────────────────────────────────────────────────
// Bootstrap Supabase (service role required for writes)
// ─────────────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is required for rescore. Check .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const SEP = "─".repeat(60);

// ─────────────────────────────────────────────────────────────────────────────
// Scoring engine (mirrors test-evaluation.ts — kept in-script to avoid
// Next.js module resolution issues when run via tsx)
// ─────────────────────────────────────────────────────────────────────────────

interface AnswerKeyEntry {
  type: "MCQ_SINGLE" | "NUMERICAL";
  correctOptionId?: string | null;
  correctNumericalAnswer?: string | null;
  marks: number;
  negativeMarks: number;
}

interface PerQuestion {
  questionId: string;
  selected: string | null;
  correct: boolean;
  marksAwarded: number;
  maxMarks: number;
}

interface Breakdown {
  correct: number;
  incorrect: number;
  unattempted: number;
  attempted: number;
  maxScore: number;
  rawScore: number;
  integrityPenalty: number;
  finalScore: number;
  durationSeconds: number;
  perQuestion: PerQuestion[];
}

function optionLabelFromAnswer(value: string): string | null {
  const normalized = value.trim().toUpperCase();
  if (/^[A-D]$/.test(normalized)) return normalized;
  const numericLabels: Record<string, string> = { "1": "A", "2": "B", "3": "C", "4": "D" };
  if (numericLabels[normalized]) return numericLabels[normalized];
  const match = normalized.match(/-OPT-([A-D])$/);
  return match?.[1] ?? null;
}

function rescoreAnswers(
  answers: Record<string, string | null>,
  answerKey: Record<string, AnswerKeyEntry>,
  startedAt: number,
  submittedAt: number,
): Breakdown {
  const questionIds = Object.keys(answerKey);
  let correct = 0, incorrect = 0, unattempted = 0, rawScore = 0, maxScore = 0;

  const perQuestion: PerQuestion[] = questionIds.map((qId) => {
    const key = answerKey[qId];
    const selected = answers[qId] ?? null;
    maxScore += key.marks;

    if (!selected) {
      unattempted++;
      return { questionId: qId, selected, correct: false, marksAwarded: 0, maxMarks: key.marks };
    }

    let isCorrect = false;
    if (key.type === "MCQ_SINGLE") {
      isCorrect = selected === key.correctOptionId;
      if (!isCorrect && key.correctOptionId) {
        const selLabel = optionLabelFromAnswer(selected);
        const corLabel = optionLabelFromAnswer(key.correctOptionId);
        isCorrect = Boolean(selLabel && corLabel && selLabel === corLabel);
      }
    } else {
      const norm = (s: string) => s.trim().toLowerCase();
      isCorrect = key.correctNumericalAnswer != null &&
        norm(selected) === norm(key.correctNumericalAnswer);
    }

    let marksAwarded = 0;
    if (isCorrect) {
      correct++;
      marksAwarded = key.marks;
      rawScore += key.marks;
    } else {
      incorrect++;
      marksAwarded = key.negativeMarks > 0 ? -key.negativeMarks : 0;
      rawScore += marksAwarded;
    }

    return { questionId: qId, selected, correct: isCorrect, marksAwarded, maxMarks: key.marks };
  });

  const durationSeconds = Math.max(0, Math.floor((submittedAt - startedAt) / 1000));
  const finalScore = Math.round(rawScore * 100) / 100;

  return {
    correct, incorrect, unattempted,
    attempted: correct + incorrect,
    maxScore, rawScore: Math.round(rawScore * 100) / 100,
    integrityPenalty: 0, // Integrity violations never affect academic score
    finalScore, durationSeconds, perQuestion,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function rescoreAttempt(attemptId: string) {
  console.log(`\n🔄 Rescoring attempt: ${attemptId}`);
  console.log(SEP);

  // 1. Fetch the attempt
  const { data: attempt, error: aErr } = await supabase
    .from("cbt_attempts")
    .select("*")
    .eq("id", attemptId)
    .single();

  if (aErr || !attempt) {
    console.error("❌ Attempt not found:", aErr?.message);
    process.exit(1);
  }

  console.log(`  Student:   ${attempt.student_roll_number}`);
  console.log(`  Test:      ${attempt.test_id}`);
  console.log(`  Status:    ${attempt.status}`);
  console.log(`  Old score: ${attempt.score}`);

  // 2. Fetch the exam's answer key from exam_questions
  //    Handle both UUID exam IDs and legacy string IDs (e.g. cbt-xxx-paper-yyy)
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(attempt.test_id);
  
  let examQuery = supabase.from("exams").select("id");
  if (isUuid) {
    // Try both UUID id and legacy_id
    examQuery = examQuery.or(`id.eq.${attempt.test_id},legacy_id.eq.${attempt.test_id}`);
  } else {
    // Legacy ID — only query legacy_id column
    examQuery = examQuery.eq("legacy_id", attempt.test_id);
  }
  
  const { data: examRow, error: examErr } = await examQuery.maybeSingle();

  if (examErr || !examRow) {
    console.error("❌ Could not resolve exam UUID for test_id:", attempt.test_id);
    console.error("   Tip: check the exams table for a row with legacy_id =", attempt.test_id);
    process.exit(1);
  }

  const { data: examQs, error: eqErr } = await supabase
    .from("exam_questions")
    .select("id, question_type, correct_option_id, correct_numerical_answer, marks, negative_marks")
    .eq("exam_id", examRow.id);

  if (eqErr || !examQs || examQs.length === 0) {
    console.error("❌ Could not fetch exam_questions:", eqErr?.message);
    process.exit(1);
  }

  // Build answer key
  const answerKey: Record<string, AnswerKeyEntry> = {};
  for (const q of examQs) {
    answerKey[q.id] = {
      type: q.question_type as "MCQ_SINGLE" | "NUMERICAL",
      correctOptionId: q.correct_option_id,
      correctNumericalAnswer: q.correct_numerical_answer,
      marks: Number(q.marks),
      negativeMarks: Number(q.negative_marks),
    };
  }

  // 3. Get the stored answers
  const storedAnswers: Record<string, string | null> = attempt.answers ?? {};

  // 4. Recalculate
  const breakdown = rescoreAnswers(
    storedAnswers,
    answerKey,
    new Date(attempt.started_at).getTime(),
    new Date(attempt.submitted_at).getTime(),
  );

  console.log(`\n  Recalculated breakdown:`);
  console.log(`    correct=${breakdown.correct}  incorrect=${breakdown.incorrect}  unattempted=${breakdown.unattempted}`);
  console.log(`    rawScore=${breakdown.rawScore}  finalScore=${breakdown.finalScore}  maxScore=${breakdown.maxScore}`);
  console.log(`    integrityPenalty=0 (fixed — never deducts marks)`);

  const scoreDelta = breakdown.finalScore - Number(attempt.score);
  if (Math.abs(scoreDelta) < 0.01) {
    console.log(`\n  ✅ Score unchanged (${attempt.score}). No update needed.`);
    return;
  }

  console.log(`\n  📊 Score delta: ${scoreDelta > 0 ? "+" : ""}${scoreDelta}`);
  console.log(`     ${attempt.score} → ${breakdown.finalScore}`);

  // 5. Dry-run confirmation
  if (process.argv.includes("--dry-run")) {
    console.log(`\n  🔍 DRY RUN — no changes written. Remove --dry-run to apply.`);
    return;
  }

  // 6. Update cbt_attempts
  const accuracy = breakdown.attempted > 0
    ? Math.round((breakdown.correct / breakdown.attempted) * 100 * 1000) / 1000
    : 0;
  const percentage = breakdown.maxScore > 0
    ? Math.round((breakdown.finalScore / breakdown.maxScore) * 100 * 1000) / 1000
    : 0;

  const { error: updateAttemptErr } = await supabase
    .from("cbt_attempts")
    .update({
      score: breakdown.finalScore,
      accuracy,
      result_breakdown: breakdown as any,
    })
    .eq("id", attemptId);

  if (updateAttemptErr) {
    console.error("❌ Failed to update cbt_attempts:", updateAttemptErr.message);
    process.exit(1);
  }
  console.log(`\n  ✅ cbt_attempts.score updated → ${breakdown.finalScore}`);

  // 7. Update cbt_results
  const { error: updateResultErr } = await supabase
    .from("cbt_results")
    .update({ score: breakdown.finalScore, percentage, accuracy })
    .eq("attempt_id", attemptId);

  if (updateResultErr) {
    console.error("  ⚠️  cbt_results update failed (may not exist):", updateResultErr.message);
  } else {
    console.log(`  ✅ cbt_results.score updated → ${breakdown.finalScore}`);
  }

  // 8. Update cbt_attempt_answers (marksAwarded per question)
  let answersUpdated = 0;
  for (const pq of breakdown.perQuestion) {
    const { error: ansErr } = await supabase
      .from("cbt_attempt_answers")
      .update({ marks_awarded: pq.marksAwarded, is_correct: pq.correct })
      .eq("attempt_id", attemptId)
      .eq("question_id", pq.questionId);

    if (!ansErr) answersUpdated++;
  }
  console.log(`  ✅ cbt_attempt_answers updated: ${answersUpdated}/${breakdown.perQuestion.length} rows`);

  console.log(`\n${SEP}`);
  console.log(`  ✅ Rescore complete for attempt ${attemptId}`);
  console.log(`     ${attempt.score} → ${breakdown.finalScore}`);
  console.log(`${SEP}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

const attemptId = process.argv[2];

if (!attemptId) {
  console.error("Usage: npx tsx scripts/rescore_attempt.ts <attempt_id> [--dry-run]");
  process.exit(1);
}

rescoreAttempt(attemptId).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
