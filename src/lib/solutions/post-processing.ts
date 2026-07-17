/**
 * Post-Processing Pipeline for V3.1 Solutions
 *
 * Flow: Generate → Compress → Validate (Structural + Semantic) → Score → Store
 *
 * LLM output is NOT trusted. This pipeline enforces quality.
 */
import type { QualityScore } from "./solution-schema-v3";

// ─── Banned Phrases ──────────────────────────────────────────────────────────
const BANNED_PHRASES = [
  // Original set
  /\bthis problem asks us to\b/i,
  /\bnow we can see that\b/i,
  /\bhence we have\b/i,
  /\bas shown above\b/i,
  /\blet'?s solve\b/i,
  /\bin this question\b/i,
  /\bwe need to find\b/i,
  /\bit is clear that\b/i,
  /\bas an ai\b/i,
  /\bcertainly\b/i,
  /\bthe image shows\b/i,
  /\bhere is\b/i,
  /\blet me\b/i,
  /\bso,\b/i,
  /\bnow,\b/i,
  /\bthus we get\b/i,
  /\bfrom the above\b/i,
  /\bwe can observe\b/i,
  /\bthe provided image\b/i,
  /\bthis image shows\b/i,
  /\bin the image\b/i,
  // New banned phrases (user spec)
  /\bthis question asks us\b/i,
  /\bwe first observe\b/i,
  /\bnow we can\b/i,
  /\bhence we get\b/i,
  /\bfrom the given figure\b/i,
  /\bby substituting\b/i,
  /\bit can be seen\b/i,
  /\bthe circuit consists of\b/i,
  /\bthe problem involves\b/i,
  /\bthe problem asks\b/i,
  /\bwe are given\b/i,
  /\bthe given\b/i,
  /\bwe observe that\b/i,
];

// ─── Filler Removal ─────────────────────────────────────────────────────────

/**
 * Strip banned phrases from a text string.
 * Returns cleaned text.
 */
export function removeFiller(text: string): string {
  let cleaned = text;
  for (const pattern of BANNED_PHRASES) {
    cleaned = cleaned.replace(new RegExp(pattern, "gi"), "").trim();
  }
  // Collapse multiple spaces/newlines
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  // Remove leading conjunctions left by filler removal
  cleaned = cleaned.replace(/^(and|but|so|thus|hence|therefore|now)\s+/i, "").trim();
  return cleaned;
}

/**
 * Check if text contains any banned filler phrases.
 */
export function containsFiller(text: string): boolean {
  return BANNED_PHRASES.some((p) => p.test(text));
}

// ─── Similarity Detection ───────────────────────────────────────────────────

/**
 * Simple word-overlap Jaccard similarity between two texts.
 * Returns a value between 0 (no overlap) and 1 (identical).
 */
function jaccardSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union;
}

/**
 * Detect high-similarity sections in the solution. Returns pairs that exceed threshold.
 */
export function findDuplicateSections(
  sections: Record<string, string>,
  threshold: number = 0.75
): Array<{ sectionA: string; sectionB: string; similarity: number }> {
  const keys = Object.keys(sections).filter((k) => sections[k]?.length > 10);
  const duplicates: Array<{ sectionA: string; sectionB: string; similarity: number }> = [];

  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const sim = jaccardSimilarity(sections[keys[i]], sections[keys[j]]);
      if (sim >= threshold) {
        duplicates.push({ sectionA: keys[i], sectionB: keys[j], similarity: sim });
      }
    }
  }
  return duplicates;
}

// ─── Deduplication ──────────────────────────────────────────────────────────

/**
 * Given a raw V3 solution object, remove redundant content.
 * Priority: keyIdea > steps > takeaway > importantObservation > shortcut
 * If two sections are >75% similar, the lower-priority one is nulled.
 */
export function deduplicateSolution(raw: any): any {
  const priorityFields = [
    "keyIdea",
    "steps",
    "takeaway",
    "importantObservation",
    "shortcut",
  ];

  // Build text map for comparison
  const textMap: Record<string, string> = {};
  if (raw.keyIdea) textMap["keyIdea"] = raw.keyIdea;
  if (raw.takeaway) textMap["takeaway"] = raw.takeaway;
  if (raw.importantObservation) textMap["importantObservation"] = raw.importantObservation;
  if (raw.shortcut) textMap["shortcut"] = raw.shortcut;

  // Also compare step reasoning concatenated
  if (raw.steps && Array.isArray(raw.steps)) {
    textMap["steps"] = raw.steps.map((s: any) => `${s.title} ${s.reasoning}`).join(" ");
  }

  const dupes = findDuplicateSections(textMap, 0.75);
  const result = { ...raw };

  for (const dupe of dupes) {
    // Keep higher-priority, null lower-priority
    const prioA = priorityFields.indexOf(dupe.sectionA);
    const prioB = priorityFields.indexOf(dupe.sectionB);
    const toRemove = prioA <= prioB ? dupe.sectionB : dupe.sectionA;

    if (toRemove !== "keyIdea" && toRemove !== "steps") {
      result[toRemove] = null;
    }
  }

  // Check commonMistakes for internal duplication
  if (result.commonMistakes && Array.isArray(result.commonMistakes)) {
    const unique: string[] = [];
    for (const m of result.commonMistakes) {
      const isDupe = unique.some((u) => jaccardSimilarity(u, m) > 0.75);
      if (!isDupe) unique.push(m);
    }
    result.commonMistakes = unique.length > 0 ? unique : null;
  }

  return result;
}

// ─── Quality Scoring ────────────────────────────────────────────────────────

/**
 * Per-mode word budget limits by difficulty.
 */
const EXAM_WORD_BUDGETS: Record<string, number> = {
  Easy: 50,
  Medium: 80,
  Hard: 120,
};

const LEARN_WORD_BUDGETS: Record<string, number> = {
  Easy: 180,
  Medium: 300,
  Hard: 420,
};

/**
 * Check similarity between Exam Mode and Learn Mode.
 * High similarity means the LLM failed to write two distinct products.
 */
export function compareModes(examMode: any, learnMode: any): number {
  if (!examMode || !learnMode) return 0;
  
  const examText = [
    ...(examMode.fastSteps || []),
    ...(examMode.examTricks || [])
  ].join(" ");
  
  const learnText = [
    ...(learnMode.steps || []).map((s: any) => s.reasoning || ""),
    learnMode.takeaway || ""
  ].join(" ");

  return jaccardSimilarity(examText, learnText);
}

// ─── Semantic Validation ────────────────────────────────────────────────────

/**
 * Semantic validation for Exam Mode.
 * Returns an array of violation descriptions. Empty = pass.
 */
export function validateExamModeSemantic(exam: any, difficulty: string): string[] {
  const violations: string[] = [];

  // 1. Check step count against difficulty limit
  const maxSteps: Record<string, number> = { Easy: 4, Medium: 5, Hard: 7 };
  const stepLimit = maxSteps[difficulty] || 5;
  if (exam.fastSteps && exam.fastSteps.length > stepLimit) {
    violations.push(`Exam step count ${exam.fastSteps.length} exceeds ${stepLimit} for ${difficulty}`);
  }

  // 2. Check for consecutive prose paragraphs (>2 steps with >20 words each = too wordy)
  if (exam.fastSteps) {
    let consecutiveProse = 0;
    for (const step of exam.fastSteps) {
      const wordCount = step.split(/\s+/).filter(Boolean).length;
      if (wordCount > 20) {
        consecutiveProse++;
      } else {
        consecutiveProse = 0;
      }
      if (consecutiveProse >= 2) {
        violations.push("Exam Mode has ≥2 consecutive prose-heavy steps (>20 words each)");
        break;
      }
    }
  }

  // 3. Check total word count for exam mode
  const examText = [
    ...(exam.fastSteps || []),
    ...(exam.examTricks || []),
    exam.finalAnswerSummary || "",
  ].join(" ");
  const examWords = examText.split(/\s+/).filter(Boolean).length;
  const examBudget = EXAM_WORD_BUDGETS[difficulty] || 80;
  if (examWords > examBudget * 1.5) {
    violations.push(`Exam Mode word count ${examWords} exceeds 1.5x budget of ${examBudget} for ${difficulty}`);
  }

  // 4. Check for textbook theory indicators
  const theoryPatterns = [
    /\baccording to the (law|theorem|principle)\b/i,
    /\bthe definition of\b/i,
    /\brecall that\b/i,
    /\bas we know\b/i,
    /\bfrom the textbook\b/i,
    /\bthe theory states\b/i,
    /\bthe formula for\b/i,
  ];
  const examAllText = (exam.fastSteps || []).join(" ");
  for (const pat of theoryPatterns) {
    if (pat.test(examAllText)) {
      violations.push(`Exam Mode contains textbook theory language: ${pat.source}`);
      break;
    }
  }

  // 5. Check for brute-force option testing
  const optionTestPatterns = [
    /\b(checking|testing|trying)\s+(each|all|every)\s+(option|choice)\b/i,
    /\boption\s+[A-D]\s*[:=].*option\s+[A-D]\s*[:=]/i,
    /\bfor\s+option\s+[A-D]\b/i,
  ];
  for (const pat of optionTestPatterns) {
    if (pat.test(examAllText)) {
      violations.push("Exam Mode uses brute-force option testing");
      break;
    }
  }

  return violations;
}

/**
 * Semantic validation for Learn Mode.
 * Returns an array of violation descriptions. Empty = pass.
 */
export function validateLearnModeSemantic(learn: any, exam: any, difficulty: string): string[] {
  const violations: string[] = [];

  // 1. Check if Learn Mode repeats Exam Mode content
  const modeSim = compareModes(exam, learn);
  if (modeSim > 0.50) {
    violations.push(`Learn Mode is ${Math.round(modeSim * 100)}% similar to Exam Mode (threshold: 50%)`);
  }

  // 2. Check for NCERT theory re-explanation
  const ncertPatterns = [
    /\bas per ncert\b/i,
    /\bthe textbook (says|states|defines)\b/i,
    /\bfrom class (11|12) (physics|chemistry|math)/i,
    /\bthe standard definition\b/i,
  ];
  const learnAllText = [
    learn.keyIdea || "",
    ...(learn.steps || []).map((s: any) => s.reasoning || ""),
    learn.takeaway || "",
  ].join(" ");

  for (const pat of ncertPatterns) {
    if (pat.test(learnAllText)) {
      violations.push(`Learn Mode contains NCERT theory re-explanation: ${pat.source}`);
      break;
    }
  }

  // 3. Check total word count
  const learnWords = learnAllText.split(/\s+/).filter(Boolean).length;
  const learnBudget = LEARN_WORD_BUDGETS[difficulty] || 300;
  if (learnWords > learnBudget * 1.3) {
    violations.push(`Learn Mode word count ${learnWords} exceeds 1.3x budget of ${learnBudget} for ${difficulty}`);
  }

  // 4. Check if keyIdea is too generic (less than 15 chars is suspicious)
  if (learn.keyIdea && learn.keyIdea.length < 15) {
    violations.push("Learn Mode keyIdea is too short/generic");
  }

  return violations;
}

/**
 * Score a V3 solution for quality.
 * Each dimension: 0-10. finalScore = weighted average.
 */
export function scoreSolution(solution: any): QualityScore {
  let clarity = 10;
  let pedagogy = 10;
  let conciseness = 10;
  let repetition = 10;
  let notationConsistency = 10;

  const learn = solution.learnMode || {};
  const exam = solution.examMode || {};
  const difficulty = solution.difficulty || "Medium";

  // ─── Clarity: keyIdea present and meaningful ──────────
  if (!learn.keyIdea || learn.keyIdea.length < 20) {
    clarity -= 3;
  }
  if (!learn.steps || learn.steps.length < 2) {
    clarity -= 3;
  }
  // Check if learn steps have reasoning
  if (learn.steps) {
    const stepsWithoutReasoning = learn.steps.filter(
      (s: any) => !s.reasoning || s.reasoning.length < 10
    );
    if (stepsWithoutReasoning.length > 0) {
      clarity -= Math.min(4, stepsWithoutReasoning.length * 2);
    }
  }

  // ─── Pedagogy: WHY before HOW ─────────────────────────
  if (!learn.keyIdea) {
    pedagogy -= 5; // No "why" at all
  }
  if (!learn.takeaway) {
    pedagogy -= 2;
  }
  if (learn.commonMistakes && learn.commonMistakes.length > 0) {
    pedagogy += 0; // bonus: already at 10
  } else {
    pedagogy -= 1; // Slight penalty for no common mistakes
  }

  // ─── Conciseness: within per-mode word budgets ────────
  const examText = [
    ...(exam.fastSteps || []),
    ...(exam.examTricks || []),
  ].join(" ");
  const examWordCount = examText.split(/\s+/).filter(Boolean).length;
  const examBudget = EXAM_WORD_BUDGETS[difficulty] || 80;

  if (examWordCount > examBudget) {
    const overBy = examWordCount - examBudget;
    conciseness -= Math.min(4, Math.ceil(overBy / 15));
  }

  const learnTextArr = [
    learn.keyIdea || "",
    ...(learn.steps || []).map((s: any) => `${s.reasoning || ""}`),
    learn.importantObservation || "",
    learn.takeaway || "",
    ...(learn.commonMistakes || []),
  ];
  const learnText = learnTextArr.join(" ");
  const learnWordCount = learnText.split(/\s+/).filter(Boolean).length;
  const learnBudget = LEARN_WORD_BUDGETS[difficulty] || 300;

  if (learnWordCount > learnBudget) {
    const overBy = learnWordCount - learnBudget;
    conciseness -= Math.min(3, Math.ceil(overBy / 30));
  }

  // ─── Repetition: check for duplicate content ──────────
  const textMap: Record<string, string> = {};
  if (learn.keyIdea) textMap["keyIdea"] = learn.keyIdea;
  if (learn.takeaway) textMap["takeaway"] = learn.takeaway;
  if (learn.importantObservation) textMap["importantObservation"] = learn.importantObservation;

  const dupes = findDuplicateSections(textMap, 0.6);
  repetition -= Math.min(6, dupes.length * 3);

  // Check if Exam Mode is just a copy-paste of Learn Mode (lowered threshold)
  const modeSim = compareModes(exam, learn);
  if (modeSim > 0.50) {
    repetition -= 5; // Severe penalty for mode copying
  } else if (modeSim > 0.35) {
    repetition -= 2; // Warning-level penalty
  }

  // ─── Filler detection ─────────────────────────────────
  const allText = [examText, learnText].join(" ");
  if (containsFiller(allText)) {
    clarity -= 2;
    conciseness -= 2;
  }

  // ─── Semantic validation penalties ────────────────────
  const examViolations = validateExamModeSemantic(exam, difficulty);
  const learnViolations = validateLearnModeSemantic(learn, exam, difficulty);

  if (examViolations.length > 0) {
    conciseness -= Math.min(3, examViolations.length);
    clarity -= Math.min(2, examViolations.length);
  }
  if (learnViolations.length > 0) {
    pedagogy -= Math.min(3, learnViolations.length);
    repetition -= Math.min(2, learnViolations.length);
  }

  // ─── Notation Consistency ─────────────────────────────
  if (learn.notations && learn.notations.length > 0) {
    const allEquations = [
      ...(learn.steps || []).map((s: any) => s.equation || ""),
      ...(exam.keyEquations || []),
    ].join(" ");
    
    if (allEquations.length > 0) {
      const unusedNotations = learn.notations.filter(
        (n: any) => !allEquations.includes(n.symbol)
      );
      if (unusedNotations.length > 0) {
        notationConsistency -= Math.min(4, unusedNotations.length * 2);
      }
    }
  } else {
    const hasEquations = (learn.steps || []).some(
      (s: any) => s.equation && s.equation.length > 0
    ) || (exam.keyEquations && exam.keyEquations.length > 0);
    
    if (hasEquations) {
      notationConsistency -= 3;
    }
  }

  // ─── Clamp all scores ─────────────────────────────────
  clarity = Math.max(0, Math.min(10, clarity));
  pedagogy = Math.max(0, Math.min(10, pedagogy));
  conciseness = Math.max(0, Math.min(10, conciseness));
  repetition = Math.max(0, Math.min(10, repetition));
  notationConsistency = Math.max(0, Math.min(10, notationConsistency));

  // Weighted average
  const finalScore = Math.round(
    (clarity * 0.25 +
      pedagogy * 0.25 +
      conciseness * 0.20 +
      repetition * 0.15 +
      notationConsistency * 0.15) *
      10
  ) / 10;

  return {
    clarity,
    pedagogy,
    conciseness,
    repetition,
    notationConsistency,
    finalScore,
  };
}

// ─── Full Post-Processing Pipeline ──────────────────────────────────────────

export interface PostProcessingResult {
  solution: any;
  qualityScore: QualityScore;
  fillerRemoved: boolean;
  sectionsDeduped: number;
  shouldRegenerate: boolean;
  examViolations: string[];
  learnViolations: string[];
}

/**
 * Full pipeline: Validate → Deduplicate → Remove Filler → Semantic Check → Score
 */
export function postProcessSolution(rawSolution: any): PostProcessingResult {
  let solution = { ...rawSolution };
  let fillerRemoved = false;
  
  const learn = solution.learnMode || {};
  const exam = solution.examMode || {};
  const difficulty = solution.difficulty || "Medium";

  // 1. Remove filler from all text fields in learnMode
  const textFields = ["keyIdea", "takeaway", "importantObservation"] as const;
  for (const field of textFields) {
    if (learn[field] && typeof learn[field] === "string") {
      const cleaned = removeFiller(learn[field]);
      if (cleaned !== learn[field]) {
        fillerRemoved = true;
        learn[field] = cleaned;
      }
      if (!learn[field] || learn[field].trim().length === 0) {
        learn[field] = null;
      }
    }
  }

  // Clean learnMode step reasoning
  if (learn.steps && Array.isArray(learn.steps)) {
    for (const step of learn.steps) {
      if (step.reasoning) {
        const cleaned = removeFiller(step.reasoning);
        if (cleaned !== step.reasoning) {
          fillerRemoved = true;
          step.reasoning = cleaned;
        }
      }
    }
  }

  // Clean learnMode common mistakes
  if (learn.commonMistakes && Array.isArray(learn.commonMistakes)) {
    learn.commonMistakes = learn.commonMistakes
      .map((m: string) => removeFiller(m))
      .filter((m: string) => m.length > 0);
    if (learn.commonMistakes.length === 0) {
      learn.commonMistakes = null;
    }
  }

  // Clean examMode fastSteps
  if (exam.fastSteps && Array.isArray(exam.fastSteps)) {
    for (let i = 0; i < exam.fastSteps.length; i++) {
      const cleaned = removeFiller(exam.fastSteps[i]);
      if (cleaned !== exam.fastSteps[i]) {
        fillerRemoved = true;
        exam.fastSteps[i] = cleaned;
      }
    }
  }

  solution.learnMode = learn;
  solution.examMode = exam;

  // 2. Semantic validation
  const examViolations = validateExamModeSemantic(exam, difficulty);
  const learnViolations = validateLearnModeSemantic(learn, exam, difficulty);

  if (examViolations.length > 0) {
    console.warn("Exam Mode semantic violations:", examViolations);
  }
  if (learnViolations.length > 0) {
    console.warn("Learn Mode semantic violations:", learnViolations);
  }

  // 3. Score
  const qualityScore = scoreSolution(solution);
  solution.qualityScore = qualityScore;

  // 4. Regeneration check
  // Regenerate if final score < 8 OR if modes are too similar (lowered threshold to 0.50)
  const isTooSimilar = compareModes(exam, learn) > 0.50;
  const hasCriticalViolations = examViolations.length >= 3 || learnViolations.length >= 3;
  const shouldRegenerate = qualityScore.finalScore < 8 || isTooSimilar || hasCriticalViolations;

  if (isTooSimilar) {
    console.warn("Regeneration flagged: Exam Strategy and Concept Breakdown are >50% identical.");
  }
  if (hasCriticalViolations) {
    console.warn("Regeneration flagged: Critical semantic violations detected.");
  }

  return {
    solution,
    qualityScore,
    fillerRemoved,
    sectionsDeduped: 0,
    shouldRegenerate,
    examViolations,
    learnViolations,
  };
}
