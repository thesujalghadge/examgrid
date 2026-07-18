import { describe, it, expect } from "vitest";
import { computeExamResult } from "../scoring";
import type { ExamDefinition, PersistedExamAttempt } from "@/types/exam";

describe("scoring.ts -> computeExamResult", () => {
  const baseExam: ExamDefinition = {
    id: "exam-1",
    title: "Test Exam",
    durationMinutes: 60,
    sections: [
      {
        id: "sec-1",
        name: "Physics",
        questionIds: ["q1"],
      },
    ],
    questions: {
      q1: {
        type: "MCQ_SINGLE",
        marks: 4,
        negativeMarks: 1, // Will be overridden in tests
        correctOptionId: "A",
      },
    },
  };

  const baseAttempt: PersistedExamAttempt = {
    id: "attempt-1",
    examId: "exam-1",
    candidateId: "cand-1",
    candidateRoll: "ROLL01",
    startedAt: 1000,
    submittedAt: 2000,
    answers: {},
    violations: [],
  };

  it("applies negative marking correctly when configured as a positive integer (1)", () => {
    const exam = {
      ...baseExam,
      questions: {
        q1: { ...baseExam.questions.q1, negativeMarks: 1 },
      },
    };
    const attempt = {
      ...baseAttempt,
      answers: { q1: "B" }, // wrong answer
    };

    const result = computeExamResult(exam, attempt, "Test Student");
    expect(result.incorrect).toBe(1);
    expect(result.totalScore).toBe(-1);
  });

  it("applies negative marking correctly when configured as a negative integer (-1)", () => {
    const exam = {
      ...baseExam,
      questions: {
        q1: { ...baseExam.questions.q1, negativeMarks: -1 },
      },
    };
    const attempt = {
      ...baseAttempt,
      answers: { q1: "B" }, // wrong answer
    };

    const result = computeExamResult(exam, attempt, "Test Student");
    expect(result.incorrect).toBe(1);
    expect(result.totalScore).toBe(-1); // Should still deduct exactly 1 mark
  });

  it("applies 0 penalty when configured as 0", () => {
    const exam = {
      ...baseExam,
      questions: {
        q1: { ...baseExam.questions.q1, negativeMarks: 0 },
      },
    };
    const attempt = {
      ...baseAttempt,
      answers: { q1: "B" }, // wrong answer
    };

    const result = computeExamResult(exam, attempt, "Test Student");
    expect(result.incorrect).toBe(1);
    expect(result.totalScore).toBe(0);
  });
});
