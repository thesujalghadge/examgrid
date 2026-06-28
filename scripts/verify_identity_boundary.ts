import { buildCbtTestFromProcessedPaper } from "../src/lib/cbt/build-test-from-processing";
import { cbtTestToExamDefinition } from "../src/lib/cbt/cbt-to-exam";
import { isUuid } from "../src/config/institute";
import type { ProcessedPaperPackage } from "../src/types/cbt-paper-processing";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
}

const now = Date.now();
const tempPaperId = `paper-${now}`;
const examId = crypto.randomUUID();

const pkg: ProcessedPaperPackage = {
  id: tempPaperId,
  status: "DRAFT_REVIEW",
  title: "Identity Boundary Paper",
  instituteId: crypto.randomUUID(),
  paperFileName: "identity.pdf",
  paperFileType: "application/pdf" as any,
  answerKeyFileName: "key.txt",
  answerKeyFileType: "text/plain" as any,
  durationMinutes: 30,
  totalQuestions: 2,
  totalMarks: 8,
  preparedAt: now,
  instructions: [],
  sections: [
    {
      id: "section-temp",
      name: "Imported Questions",
      questions: [
        {
          questionId: `${tempPaperId}-q1`,
          sequence: 1,
          section: "Imported Questions",
          subject: "Mathematics",
          chapter: "General",
          topic: "General",
          confidence: 1,
          questionType: "MCQ_SINGLE",
          detectionSource: "manual",
          questionText: "What is 2+2?",
          hasEquation: false,
          hasImage: false,
          correctAnswer: "A",
          marks: 4,
          negativeMarks: 1,
          optionLabels: ["4", "5", "6", "7"],
          images: [],
          metadata: { sourceQuestionNumber: 1 },
        },
        {
          questionId: `${tempPaperId}-q2`,
          sequence: 2,
          section: "Imported Questions",
          subject: "Mathematics",
          chapter: "General",
          topic: "General",
          confidence: 1,
          questionType: "MCQ_SINGLE",
          detectionSource: "manual",
          questionText: "What is 3+3?",
          hasEquation: false,
          hasImage: false,
          correctAnswer: "B",
          marks: 4,
          negativeMarks: 1,
          optionLabels: ["5", "6", "7", "8"],
          images: [],
          metadata: { sourceQuestionNumber: 2 },
        },
      ],
    },
  ],
  answerKey: [],
  extractionSummary: { warnings: [], pageCount: 1, detectedQuestionCount: 2 } as any,
  parsingDiagnostics: { duplicateAnswers: [], missingAnswers: [], extraAnswers: [] } as any,
};

const { test, bankQuestions } = buildCbtTestFromProcessedPaper(pkg, examId, [], "identity-audit");
assert(isUuid(test.id), "exam/test id is UUID before persistence");
assert(bankQuestions.every((q) => isUuid(q.id)), "bank question IDs are UUIDs before persistence");
assert(test.sections.every((s) => isUuid(s.id)), "exam section IDs are UUIDs before persistence");
assert(test.questions.every((q) => isUuid(q.id) && isUuid(q.questionId) && isUuid(q.bankQuestionId ?? "")), "CBT row, exam question, and bank refs are UUIDs before persistence");

const exam = cbtTestToExamDefinition(test, bankQuestions);
assert(exam, "exam definition builds from UUID-only CBT test");
assert(Object.keys(exam.questions).every(isUuid), "exam definition question map uses UUID keys");
assert(exam.sections.every((s) => isUuid(s.id) && s.questionIds.every(isUuid)), "exam definition sections reference UUID question IDs");

console.log("Identity boundary verifier completed successfully.");
