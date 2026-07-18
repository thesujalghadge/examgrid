/**
 * rescore_exam.ts
 *
 * Recalculates the score for ALL submitted CBT attempts for a given exam.
 * It uses the current scoring engine to update cbt_attempts, cbt_results,
 * and cbt_attempt_answers.
 * 
 * Finally, it enqueues an analytics job for each attempt, which automatically
 * regenerates ranks, question analytics, and cumulative reports.
 *
 * Usage:
 *   npx tsx scripts/rescore_exam.ts <exam_id>
 *
 * Example:
 *   npx tsx scripts/rescore_exam.ts cbt-baceec09-9792-4dab-b988-5a1c8f2d461f-paper-1782154833645
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
// Scoring engine (mirrors test-evaluation.ts)
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
      const penalty = Math.abs(key.negativeMarks || 0);
      marksAwarded = penalty > 0 ? -penalty : 0;
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

async function rescoreExam(examId: string) {
  console.log(`\n🔄 Rescoring ALL attempts for exam: ${examId}`);
  console.log(SEP);

  // 1. Fetch the exam's answer key from exam_questions
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(examId);
  
  let examQuery = supabase.from("exams").select("id, legacy_id");
  if (isUuid) {
    examQuery = examQuery.or(`id.eq.${examId},legacy_id.eq.${examId}`);
  } else {
    examQuery = examQuery.eq("legacy_id", examId);
  }
  
  const { data: examRow, error: examErr } = await examQuery.maybeSingle();

  if (examErr || !examRow) {
    console.error("❌ Could not resolve exam UUID for exam_id:", examId);
    console.error("   Tip: check the exams table for a row with legacy_id =", examId);
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

  console.log(`  ✅ Loaded answer key for ${examQs.length} questions.`);

  // 2. Fetch all attempts for this exam
  const orFilter = examRow.legacy_id
    ? `test_id.eq.${examRow.id},test_id.eq.${examRow.legacy_id}`
    : `test_id.eq.${examRow.id}`;

  const { data: attempts, error: aErr } = await supabase
    .from("cbt_attempts")
    .select("*")
    .or(orFilter);

  if (aErr) {
    console.error("❌ Failed to fetch attempts:", aErr.message);
    process.exit(1);
  }

  if (!attempts || attempts.length === 0) {
    console.log(`  ⚠️ No attempts found for exam ${examId}.`);
    return;
  }

  console.log(`  ✅ Found ${attempts.length} attempts to rescore.`);
  
  const isDryRun = process.argv.includes("--dry-run");

  // 3. Process each attempt
  let updatedCount = 0;
  for (const attempt of attempts) {
    if (attempt.status !== "submitted" && attempt.status !== "auto_submitted") {
      console.log(`  ⏭️ Skipping attempt ${attempt.id} (status: ${attempt.status})`);
      continue;
    }

    const storedAnswers: Record<string, string | null> = attempt.answers ?? {};
    
    const breakdown = rescoreAnswers(
      storedAnswers,
      answerKey,
      new Date(attempt.started_at).getTime(),
      new Date(attempt.submitted_at).getTime(),
    );

    const scoreDelta = breakdown.finalScore - Number(attempt.score);
    if (Math.abs(scoreDelta) < 0.01) {
      // Even if score is unchanged, we might still want to re-queue analytics just in case,
      // but let's only update if the score explicitly changed or if --force is used.
      if (!process.argv.includes("--force")) {
        console.log(`  ✅ [${attempt.student_roll_number}] Score unchanged (${attempt.score}).`);
        continue;
      }
    }

    console.log(`  📊 [${attempt.student_roll_number}] Score delta: ${scoreDelta > 0 ? "+" : ""}${scoreDelta} (${attempt.score} → ${breakdown.finalScore})`);
    
    if (isDryRun) continue;

    const accuracy = breakdown.attempted > 0
      ? Math.round((breakdown.correct / breakdown.attempted) * 100 * 1000) / 1000
      : 0;
    const percentage = breakdown.maxScore > 0
      ? Math.round((breakdown.finalScore / breakdown.maxScore) * 100 * 1000) / 1000
      : 0;

    await supabase.from("cbt_attempts").update({
      score: breakdown.finalScore,
      accuracy,
      result_breakdown: breakdown as any,
    }).eq("id", attempt.id);

    await supabase.from("cbt_results").update({
      score: breakdown.finalScore, percentage, accuracy
    }).eq("attempt_id", attempt.id);

    for (const pq of breakdown.perQuestion) {
      await supabase.from("cbt_attempt_answers")
        .update({ marks_awarded: pq.marksAwarded, is_correct: pq.correct })
        .eq("attempt_id", attempt.id)
        .eq("question_id", pq.questionId);
    }

    // Insert an analytics job to regenerate ranks and cumulative stats
    await supabase.from("analytics_jobs").insert({
      attempt_id: attempt.id,
      exam_id: attempt.test_id,
      student_id: attempt.student_id,
      batch_id: attempt.batch_id,
      institute_id: attempt.institute_id,
      status: "PENDING"
    });

    updatedCount++;
  }

  console.log(`\n${SEP}`);
  if (isDryRun) {
    console.log(`  🔍 DRY RUN COMPLETE — no changes written. Remove --dry-run to apply.`);
  } else {
    console.log(`  ✅ Rescore complete for exam ${examId}`);
    console.log(`     Updated ${updatedCount} attempts.`);
    console.log(`     Analytics regeneration queued (background worker will process).`);
  }
  console.log(`${SEP}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Entry point
// ─────────────────────────────────────────────────────────────────────────────

const examId = process.argv[2];

if (!examId) {
  console.error("Usage: npx tsx scripts/rescore_exam.ts <exam_id> [--dry-run] [--force]");
  process.exit(1);
}

rescoreExam(examId).catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
