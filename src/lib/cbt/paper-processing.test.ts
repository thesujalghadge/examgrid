import { describe, expect, it } from "vitest";
import { toNormalizedQuestion } from "@/lib/cbt/normalized-question";
import { applySubjectMapping, resolveSubjectForQuestion } from "@/lib/cbt/subject-mapping";
import {
  isNumericAnswer,
  parseAnswerKeyForTest,
  parsePaperTextForTest,
  resolveQuestionType,
} from "@/lib/cbt/paper-processing";
import {
  JEE_ANSWER_KEY,
  JEE_INLINE_MCQ_BLOCK,
  JEE_MIXED_PAPER,
  JEE_MULTILINE_MCQ_BLOCK,
  JEE_NUMERICAL_BLOCK,
} from "@/lib/cbt/__fixtures__/jee-sample-papers";

describe("paper-processing JEE-style extraction", () => {
  it("parses multiline wrapped MCQ options separately from stem", () => {
    const questions = parsePaperTextForTest(JEE_MULTILINE_MCQ_BLOCK);
    expect(questions).toHaveLength(2);

    const first = toNormalizedQuestion(questions[0]);
    expect(first.type).toBe("MCQ_SINGLE");
    expect(first.stem).toContain("frictionless incline");
    expect(first.stem).not.toMatch(/\([A-D]\)/);
    expect(first.options).toHaveLength(4);
    expect(first.options[0]).toContain("g/2");
    expect(first.options[3]).toContain("g/6");
  });

  it("parses inline coaching-format MCQs on one line", () => {
    const questions = parsePaperTextForTest(JEE_INLINE_MCQ_BLOCK);
    expect(questions).toHaveLength(2);

    const first = toNormalizedQuestion(questions[0]);
    expect(first.type).toBe("MCQ_SINGLE");
    expect(first.stem).toContain("aldehyde");
    expect(first.options.length).toBeGreaterThanOrEqual(2);
    expect(first.options.join(" ")).toMatch(/Methanal|Methanol/);
  });

  it("classifies questions without options as numerical", () => {
    const questions = parsePaperTextForTest(JEE_NUMERICAL_BLOCK);
    expect(questions).toHaveLength(2);

    for (const question of questions) {
      const normalized = toNormalizedQuestion(question);
      expect(normalized.type).toBe("NUMERICAL");
      expect(normalized.options).toHaveLength(0);
      expect(normalized.stem.length).toBeGreaterThan(5);
    }
  });

  it("maps answer key and preserves section subjects", () => {
    const questions = parsePaperTextForTest(JEE_MIXED_PAPER, JEE_ANSWER_KEY);
    expect(questions).toHaveLength(3);

    const physicsMcq = toNormalizedQuestion(questions[0]);
    expect(physicsMcq.type).toBe("MCQ_SINGLE");
    expect(physicsMcq.answer).toBe("A");
    expect(questions[0].section).toBe("Physics");

    const physicsNumerical = toNormalizedQuestion(questions[1]);
    expect(physicsNumerical.type).toBe("NUMERICAL");
    expect(physicsNumerical.options).toHaveLength(0);

    const chemistryMcq = toNormalizedQuestion(questions[2]);
    expect(chemistryMcq.type).toBe("MCQ_SINGLE");
    expect(chemistryMcq.answer).toBe("C");
    expect(questions[2].section).toBe("Chemistry");
  });

  it("parses common coaching answer key formats", () => {
    const key = `
1-A
2. B
3 A
4,C
5->C
6: D
7 - 42
8	9
    `;
    const entries = parseAnswerKeyForTest(key);
    expect(entries.find((e) => e.questionNumber === 1)?.answer).toBe("A");
    expect(entries.find((e) => e.questionNumber === 2)?.answer).toBe("B");
    expect(entries.find((e) => e.questionNumber === 3)?.answer).toBe("A");
    expect(entries.find((e) => e.questionNumber === 4)?.answer).toBe("C");
    expect(entries.find((e) => e.questionNumber === 5)?.answer).toBe("C");
    expect(entries.find((e) => e.questionNumber === 6)?.answer).toBe("D");
    expect(entries.find((e) => e.questionNumber === 7)?.answer).toBe("42");
  });

  it("does not classify as numerical when answer key is a letter but options are missing", () => {
    const type = resolveQuestionType([], "B", "A particle moves with velocity v.");
    expect(type).toBe("MCQ_SINGLE");
    expect(isNumericAnswer("B")).toBe(false);
  });

  it("applies multi-subject range mapping by global question number", () => {
    const pkg = applySubjectMapping({
      id: "paper-test",
      status: "DRAFT_REVIEW",
      title: "Test",
      instituteId: "inst-1",
      paperFileName: "test.txt",
      paperFileType: "txt",
      durationMinutes: 60,
      instructions: [],
      sections: [
        {
          id: "section-physics",
          name: "Physics",
          questions: parsePaperTextForTest(JEE_MIXED_PAPER).slice(0, 2),
        },
        {
          id: "section-chemistry",
          name: "Chemistry",
          questions: parsePaperTextForTest(JEE_MIXED_PAPER).slice(2),
        },
      ],
      processingLog: [],
      validationIssues: [],
      extractionMode: "manual",
      extractionSummary: {
        pages: 1,
        extractedChars: 100,
        usedOCR: false,
        questionsDetected: 3,
        warnings: [],
      },
      parsingDiagnostics: {
        rawTextPreview: "",
        parsedQuestionCount: 3,
        unmatchedAnswerCount: 0,
        unmatchedAnswers: [],
        duplicateAnswers: [],
      },
      preparedAt: Date.now(),
      totalMarks: 12,
      totalQuestions: 3,
      subjectMapping: {
        layout: "two",
        mode: "multi",
        ranges: [
          { start: 1, end: 2, subject: "Physics" },
          { start: 3, end: 3, subject: "Chemistry" },
        ],
      },
    });

    expect(resolveSubjectForQuestion(1, pkg.subjectMapping!)).toBe("Physics");
    expect(resolveSubjectForQuestion(3, pkg.subjectMapping!)).toBe("Chemistry");
    expect(pkg.sections[1].questions[0].subject).toBe("Chemistry");
  });
});
