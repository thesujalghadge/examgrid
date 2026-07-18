/**
 * Scoring Engine Unit Tests
 *
 * Tests for evaluateTestSession() covering all JEE Main marking scenarios.
 * Run: npm test
 */
import { describe, it, expect, beforeEach } from "vitest";
import { evaluateTestSession, clearEvaluationCache } from "@/services/test-evaluation";
import type { TestAnswerKey } from "@/types/test-session";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal MCQ answer key entry */
function mcqKey(correctOptionId: string, marks = 4, negativeMarks = 1) {
  return { type: "MCQ_SINGLE" as const, correctOptionId, marks, negativeMarks };
}

/** Build a minimal NUMERICAL answer key entry (no negative marking in JEE Main) */
function natKey(correctNumericalAnswer: string, marks = 4, negativeMarks = 0) {
  return { type: "NUMERICAL" as const, correctNumericalAnswer, marks, negativeMarks };
}

const BASE_TIME = 1_700_000_000_000;

function runEval(params: {
  answers: Record<string, string | null>;
  answerKey: TestAnswerKey;
  integrityEvents?: any[];
}) {
  clearEvaluationCache();
  return evaluateTestSession({
    sessionId: `test-${Math.random()}`,
    answers: params.answers,
    answerKey: params.answerKey,
    startedAt: BASE_TIME,
    submittedAt: BASE_TIME + 3 * 60 * 60 * 1000, // 3 hours later
    integrityEvents: params.integrityEvents ?? [],
    useCache: false,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Regression tests from live production bugs
// ─────────────────────────────────────────────────────────────────────────────

describe("PRODUCTION REGRESSION — real student data from 75Q exam", () => {
  it("STUDENT001: 11 correct, 15 wrong (14 MCQ + 1 NAT wrong) → expect 30", () => {
    // Diagnostic confirmed: one wrong was NAT (negativeMarks=0), rest MCQ (negativeMarks=1)
    // 11×4 - 14×1 - 0×0 = 44 - 14 = 30 ✓
    const key: TestAnswerKey = {};
    for (let i = 1; i <= 74; i++) key[`q${i}`] = mcqKey(`q${i}-opt-A`);
    key["q75"] = natKey("42"); // NAT question

    const answers: Record<string, string | null> = {};
    // 11 correct MCQ
    for (let i = 1; i <= 11; i++) answers[`q${i}`] = `q${i}-opt-A`;
    // 14 wrong MCQ
    for (let i = 12; i <= 25; i++) answers[`q${i}`] = `q${i}-opt-B`;
    // 1 wrong NAT (no negative marks)
    answers["q75"] = "99";
    // rest unattempted (null)
    for (let i = 26; i <= 74; i++) answers[`q${i}`] = null;
    answers["q75"] = "99"; // wrong NAT

    const result = runEval({ answers, answerKey: key });
    expect(result.correct).toBe(11);
    expect(result.incorrect).toBe(15);
    expect(result.rawScore).toBe(30);
    expect(result.finalScore).toBe(30);
    expect(result.integrityPenalty).toBe(0);
  });

  it("STUDENT002: integrityPenalty must ALWAYS be 0 regardless of tab switches", () => {
    // The bug: penalty was (deficit/100) × maxScore = 117 points on a 300-mark exam
    // Fix: integrityPenaltyPoints always returns 0
    const key: TestAnswerKey = {};
    for (let i = 1; i <= 75; i++) key[`q${i}`] = mcqKey(`q${i}-opt-A`);

    const answers: Record<string, string | null> = {};
    for (let i = 1; i <= 10; i++) answers[`q${i}`] = `q${i}-opt-A`; // 10 correct
    for (let i = 11; i <= 22; i++) answers[`q${i}`] = `q${i}-opt-B`; // 12 wrong
    for (let i = 23; i <= 75; i++) answers[`q${i}`] = null; // unattempted

    // Simulate heavy integrity violations (many tab switches etc.)
    const integrityEvents = Array.from({ length: 50 }, (_, i) => ({
      type: "tab_switch" as const,
      at: BASE_TIME + i * 1000,
    }));

    const result = runEval({ answers, answerKey: key, integrityEvents });
    expect(result.integrityPenalty).toBe(0); // MUST be zero — never deduct academic marks
    expect(result.correct).toBe(10);
    expect(result.incorrect).toBe(12);
    expect(result.rawScore).toBe(28); // 10×4 - 12×1 = 28
    expect(result.finalScore).toBe(28); // integrity never reduces score
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// JEE Main standard marking: +4 / -1
// ─────────────────────────────────────────────────────────────────────────────

describe("JEE Main — standard marking (+4 / -1)", () => {
  it("all correct: 75 questions → 300", () => {
    const key: TestAnswerKey = {};
    const answers: Record<string, string | null> = {};
    for (let i = 1; i <= 75; i++) {
      key[`q${i}`] = mcqKey(`q${i}-opt-A`);
      answers[`q${i}`] = `q${i}-opt-A`;
    }
    const result = runEval({ answers, answerKey: key });
    expect(result.correct).toBe(75);
    expect(result.incorrect).toBe(0);
    expect(result.unattempted).toBe(0);
    expect(result.rawScore).toBe(300);
    expect(result.finalScore).toBe(300);
    expect(result.maxScore).toBe(300);
  });

  it("all wrong: 75 questions → -75", () => {
    const key: TestAnswerKey = {};
    const answers: Record<string, string | null> = {};
    for (let i = 1; i <= 75; i++) {
      key[`q${i}`] = mcqKey(`q${i}-opt-A`);
      answers[`q${i}`] = `q${i}-opt-B`; // always wrong
    }
    const result = runEval({ answers, answerKey: key });
    expect(result.correct).toBe(0);
    expect(result.incorrect).toBe(75);
    expect(result.unattempted).toBe(0);
    expect(result.rawScore).toBe(-75);
    expect(result.finalScore).toBe(-75);
  });

  it("all unattempted: 75 questions → 0", () => {
    const key: TestAnswerKey = {};
    const answers: Record<string, string | null> = {};
    for (let i = 1; i <= 75; i++) {
      key[`q${i}`] = mcqKey(`q${i}-opt-A`);
      answers[`q${i}`] = null;
    }
    const result = runEval({ answers, answerKey: key });
    expect(result.correct).toBe(0);
    expect(result.incorrect).toBe(0);
    expect(result.unattempted).toBe(75);
    expect(result.rawScore).toBe(0);
    expect(result.finalScore).toBe(0);
  });

  it("mixed: 11 correct, 15 wrong → 44 - 15 = 29 (all MCQ with negative marks)", () => {
    // Classic JEE Main formula: pure MCQ, 11×4 - 15×1 = 29
    const key: TestAnswerKey = {};
    const answers: Record<string, string | null> = {};
    for (let i = 1; i <= 75; i++) {
      key[`q${i}`] = mcqKey(`q${i}-opt-A`);
      answers[`q${i}`] = null;
    }
    for (let i = 1; i <= 11; i++) answers[`q${i}`] = `q${i}-opt-A`; // correct
    for (let i = 12; i <= 26; i++) answers[`q${i}`] = `q${i}-opt-B`; // wrong (15 total)

    const result = runEval({ answers, answerKey: key });
    expect(result.correct).toBe(11);
    expect(result.incorrect).toBe(15);
    expect(result.rawScore).toBe(29); // 44 - 15
    expect(result.finalScore).toBe(29);
  });

  it("mixed: 10 correct, 12 wrong → 40 - 12 = 28", () => {
    const key: TestAnswerKey = {};
    const answers: Record<string, string | null> = {};
    for (let i = 1; i <= 75; i++) {
      key[`q${i}`] = mcqKey(`q${i}-opt-A`);
      answers[`q${i}`] = null;
    }
    for (let i = 1; i <= 10; i++) answers[`q${i}`] = `q${i}-opt-A`; // correct
    for (let i = 11; i <= 22; i++) answers[`q${i}`] = `q${i}-opt-B`; // wrong

    const result = runEval({ answers, answerKey: key });
    expect(result.correct).toBe(10);
    expect(result.incorrect).toBe(12);
    expect(result.rawScore).toBe(28);
    expect(result.finalScore).toBe(28);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Numerical / Integer type questions
// ─────────────────────────────────────────────────────────────────────────────

describe("NUMERICAL questions — no negative marking in JEE Main", () => {
  it("correct NAT answer → +4", () => {
    const key: TestAnswerKey = { q1: natKey("42") };
    const result = runEval({ answers: { q1: "42" }, answerKey: key });
    expect(result.correct).toBe(1);
    expect(result.rawScore).toBe(4);
    expect(result.finalScore).toBe(4);
  });

  it("wrong NAT answer → 0 (not -1)", () => {
    const key: TestAnswerKey = { q1: natKey("42") };
    const result = runEval({ answers: { q1: "99" }, answerKey: key });
    expect(result.incorrect).toBe(1);
    expect(result.rawScore).toBe(0); // NAT negative_marks = 0
    expect(result.finalScore).toBe(0);
    // Critically: marks_awarded must be 0, not -1
    const perQ = result.perQuestion.find((q) => q.questionId === "q1");
    expect(perQ?.marksAwarded).toBe(0);
  });

  it("unattempted NAT → 0", () => {
    const key: TestAnswerKey = { q1: natKey("42") };
    const result = runEval({ answers: { q1: null }, answerKey: key });
    expect(result.unattempted).toBe(1);
    expect(result.rawScore).toBe(0);
  });

  it("NAT whitespace normalization: '  42  ' matches '42'", () => {
    const key: TestAnswerKey = { q1: natKey("42") };
    const result = runEval({ answers: { q1: "  42  " }, answerKey: key });
    expect(result.correct).toBe(1);
    expect(result.rawScore).toBe(4);
  });

  it("NAT case normalization: '3.14' matches '3.14'", () => {
    const key: TestAnswerKey = { q1: natKey("3.14") };
    const result = runEval({ answers: { q1: "3.14" }, answerKey: key });
    expect(result.correct).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section-specific marking (e.g., Section A: 4/-1, Section B: 4/0)
// ─────────────────────────────────────────────────────────────────────────────

describe("Section-specific marking", () => {
  it("Section B with 4/0: wrong answer gives 0 not -1", () => {
    const key: TestAnswerKey = {
      // Section A: standard
      sa1: mcqKey("sa1-opt-A", 4, 1),
      sa2: mcqKey("sa2-opt-A", 4, 1),
      // Section B: no negative marking
      sb1: mcqKey("sb1-opt-A", 4, 0),
      sb2: mcqKey("sb2-opt-A", 4, 0),
    };
    const answers = {
      sa1: "sa1-opt-A", // correct
      sa2: "sa2-opt-B", // wrong, -1
      sb1: "sb1-opt-B", // wrong, 0 (no negative)
      sb2: null,         // unattempted
    };
    const result = runEval({ answers, answerKey: key });
    expect(result.correct).toBe(1);
    expect(result.incorrect).toBe(2);
    expect(result.rawScore).toBe(4 - 1 + 0); // 3
    expect(result.finalScore).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Option ID matching (flexible format support)
// ─────────────────────────────────────────────────────────────────────────────

describe("MCQ option ID matching", () => {
  it("exact option ID match", () => {
    const key: TestAnswerKey = { q1: mcqKey("q1-opt-A") };
    expect(runEval({ answers: { q1: "q1-opt-A" }, answerKey: key }).correct).toBe(1);
  });

  it("label fallback: 'A' matches option ID ending in -opt-A", () => {
    const key: TestAnswerKey = { q1: mcqKey("q1-opt-A") };
    expect(runEval({ answers: { q1: "A" }, answerKey: key }).correct).toBe(1);
  });

  it("numeric label fallback: '1' matches option ID ending in -opt-A", () => {
    const key: TestAnswerKey = { q1: mcqKey("q1-opt-A") };
    expect(runEval({ answers: { q1: "1" }, answerKey: key }).correct).toBe(1);
  });

  it("wrong option: 'B' vs correct 'A' → incorrect", () => {
    const key: TestAnswerKey = { q1: mcqKey("q1-opt-A") };
    expect(runEval({ answers: { q1: "B" }, answerKey: key }).incorrect).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Integrity events must NEVER reduce academic score
// ─────────────────────────────────────────────────────────────────────────────

describe("Integrity events — no score impact", () => {
  const key: TestAnswerKey = { q1: mcqKey("q1-opt-A") };
  const rightAnswer = { q1: "q1-opt-A" };

  const allEventTypes = [
    "tab_switch",
    "fullscreen_exit",
    "window_blur",
    "copy_attempt",
    "paste_attempt",
    "rapid_navigation",
    "browser_back",
  ] as const;

  for (const eventType of allEventTypes) {
    it(`100 × ${eventType} events → finalScore unchanged`, () => {
      const events = Array.from({ length: 100 }, (_, i) => ({
        type: eventType,
        at: BASE_TIME + i * 500,
      }));
      const result = runEval({ answers: rightAnswer, answerKey: key, integrityEvents: events });
      expect(result.integrityPenalty).toBe(0);
      expect(result.finalScore).toBe(4);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// maxScore calculation
// ─────────────────────────────────────────────────────────────────────────────

describe("maxScore calculation", () => {
  it("75 MCQ questions × 4 marks = 300 maxScore", () => {
    const key: TestAnswerKey = {};
    for (let i = 1; i <= 75; i++) key[`q${i}`] = mcqKey(`q${i}-opt-A`);
    const result = runEval({ answers: {}, answerKey: key });
    expect(result.maxScore).toBe(300);
  });

  it("mixed: 20 MCQ (4 marks) + 5 NAT (4 marks) = 100 maxScore", () => {
    const key: TestAnswerKey = {};
    for (let i = 1; i <= 20; i++) key[`q${i}`] = mcqKey(`q${i}-opt-A`, 4, 1);
    for (let i = 21; i <= 25; i++) key[`q${i}`] = natKey("0", 4, 0);
    const result = runEval({ answers: {}, answerKey: key });
    expect(result.maxScore).toBe(100);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// perQuestion result entries
// ─────────────────────────────────────────────────────────────────────────────

describe("perQuestion result entries", () => {
  it("each question has a result entry", () => {
    const key: TestAnswerKey = {};
    for (let i = 1; i <= 5; i++) key[`q${i}`] = mcqKey(`q${i}-opt-A`);
    const result = runEval({ answers: {}, answerKey: key });
    expect(result.perQuestion).toHaveLength(5);
  });

  it("correct question: marksAwarded = marks", () => {
    const key: TestAnswerKey = { q1: mcqKey("q1-opt-A", 4, 1) };
    const result = runEval({ answers: { q1: "q1-opt-A" }, answerKey: key });
    expect(result.perQuestion[0].marksAwarded).toBe(4);
    expect(result.perQuestion[0].correct).toBe(true);
  });

  it("wrong MCQ question: marksAwarded = -negativeMarks", () => {
    const key: TestAnswerKey = { q1: mcqKey("q1-opt-A", 4, 1) };
    const result = runEval({ answers: { q1: "q1-opt-B" }, answerKey: key });
    expect(result.perQuestion[0].marksAwarded).toBe(-1);
    expect(result.perQuestion[0].correct).toBe(false);
  });

  it("unattempted question: marksAwarded = 0", () => {
    const key: TestAnswerKey = { q1: mcqKey("q1-opt-A", 4, 1) };
    const result = runEval({ answers: { q1: null }, answerKey: key });
    expect(result.perQuestion[0].marksAwarded).toBe(0);
    expect(result.perQuestion[0].correct).toBe(false);
  });

  it("wrong NAT question: marksAwarded = 0 (not -1)", () => {
    const key: TestAnswerKey = { q1: natKey("42", 4, 0) };
    const result = runEval({ answers: { q1: "99" }, answerKey: key });
    expect(result.perQuestion[0].marksAwarded).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Negative marking configuration edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe("Negative marking configuration edge cases", () => {
  it("deducts points correctly when negativeMarks is configured as a negative number (-1)", () => {
    const key: TestAnswerKey = { q1: mcqKey("q1-opt-A", 4, -1) };
    const result = runEval({ answers: { q1: "q1-opt-B" }, answerKey: key });
    expect(result.incorrect).toBe(1);
    expect(result.rawScore).toBe(-1); // Absolute value logic ensures this applies -1
    expect(result.perQuestion[0].marksAwarded).toBe(-1);
  });

  it("deducts points correctly when negativeMarks is configured as a positive number (1)", () => {
    const key: TestAnswerKey = { q1: mcqKey("q1-opt-A", 4, 1) };
    const result = runEval({ answers: { q1: "q1-opt-B" }, answerKey: key });
    expect(result.incorrect).toBe(1);
    expect(result.rawScore).toBe(-1);
    expect(result.perQuestion[0].marksAwarded).toBe(-1);
  });
});
