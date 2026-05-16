import type { ExamDefinition, ExamQuestion, QuestionType } from "@/types/exam";

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

function buildMcqQuestion(
  sectionId: string,
  sectionPrefix: string,
  num: number,
  correctIdx: number,
): ExamQuestion {
  const options = OPTION_LABELS.map((label, idx) => ({
    id: `${sectionId}-q${num}-opt${label}`,
    label,
    text: `Option ${label} for ${sectionPrefix} Question ${num}`,
  }));
  return {
    id: `${sectionId}-q${num}`,
    sectionId,
    number: num,
    type: "MCQ_SINGLE",
    text: `${sectionPrefix} — Q${num}: A particle moves with velocity v = (2t² î + 3t ĵ) m/s. Find the magnitude of acceleration at t = 2 s. (MCQ stem)`,
    options,
    correctOptionId: options[correctIdx].id,
    marks: 4,
    negativeMarks: 1,
  };
}

function buildNumericalQuestion(
  sectionId: string,
  sectionPrefix: string,
  num: number,
  correctAnswer: string,
): ExamQuestion {
  return {
    id: `${sectionId}-q${num}`,
    sectionId,
    number: num,
    type: "NUMERICAL",
    text: `${sectionPrefix} — Q${num}: Enter the numerical value of the required quantity. (Round to two decimal places if needed.)`,
    options: [],
    correctNumericalAnswer: correctAnswer,
    marks: 4,
    negativeMarks: 0,
  };
}

function buildSectionQuestions(
  sectionId: string,
  sectionPrefix: string,
  count: number,
  mcqPattern: number[],
  numericalSlots: number[],
  numericalAnswers: string[],
): ExamQuestion[] {
  return Array.from({ length: count }, (_, i) => {
    const num = i + 1;
    const numIdx = numericalSlots.indexOf(num);
    if (numIdx >= 0) {
      return buildNumericalQuestion(
        sectionId,
        sectionPrefix,
        num,
        numericalAnswers[numIdx] ?? "0",
      );
    }
    return buildMcqQuestion(
      sectionId,
      sectionPrefix,
      num,
      mcqPattern[i % mcqPattern.length],
    );
  });
}

function toQuestionRecord(questions: ExamQuestion[]): Record<string, ExamQuestion> {
  return Object.fromEntries(questions.map((q) => [q.id, q]));
}

const physicsQuestions = buildSectionQuestions(
  "physics",
  "Physics",
  10,
  [0, 1, 2, 3, 0, 1, 2, 3, 0, 1],
  [3, 7, 10],
  ["4.00", "9.81", "120"],
);
const chemistryQuestions = buildSectionQuestions(
  "chemistry",
  "Chemistry",
  10,
  [1, 2, 3, 0, 1, 2, 3, 0, 1, 2],
  [2, 6, 9],
  ["22.4", "6.02", "14"],
);
const mathsQuestions = buildSectionQuestions(
  "mathematics",
  "Mathematics",
  10,
  [2, 3, 0, 1, 2, 3, 0, 1, 2, 3],
  [4, 8, 10],
  ["3.14", "2.718", "1"],
);

const jeeQuestions = [
  ...physicsQuestions,
  ...chemistryQuestions,
  ...mathsQuestions,
];

export const JEE_MAIN_MOCK: ExamDefinition = {
  id: "jee-main-mock-1",
  title: "JEE Main 2026 — Mock Test 1",
  subtitle: "Computer Based Test (CBT) — Mixed MCQ & Numerical",
  examType: "JEE_MAIN",
  durationMinutes: 180,
  totalQuestions: 30,
  scheduledAt: "2026-05-20T09:00:00+05:30",
  sections: [
    {
      id: "physics",
      name: "Physics",
      questionIds: physicsQuestions.map((q) => q.id),
    },
    {
      id: "chemistry",
      name: "Chemistry",
      questionIds: chemistryQuestions.map((q) => q.id),
    },
    {
      id: "mathematics",
      name: "Mathematics",
      questionIds: mathsQuestions.map((q) => q.id),
    },
  ],
  questions: toQuestionRecord(jeeQuestions),
  instructions: [
    "Total duration of the examination is 180 minutes (3 hours).",
    "The clock will be set at the server. The countdown timer at the top right of the screen will display the remaining time available for you to complete the examination.",
    "When the timer reaches zero, the examination will end by itself. You need not terminate or submit your examination.",
    "The Question Palette displayed on the right side of screen will show the status of each question using the following symbols.",
    "This paper contains MCQ (Single Correct) and Numerical Value Type questions.",
    "For Numerical questions, enter your answer in the input field. Only numeric values and decimal point are allowed.",
    "A scientific calculator is available via the Calculator button during the examination.",
    "Do not switch tabs or exit fullscreen during the examination. Violations are recorded.",
    "Sections in this question paper are displayed on the top bar.",
  ],
};

export const MOCK_EXAMS: ExamDefinition[] = [JEE_MAIN_MOCK];

export { getExamById, listAllExams } from "@/lib/exam-catalog";

export function getFirstQuestionId(exam: ExamDefinition): string {
  return exam.sections[0].questionIds[0];
}

export function getQuestionGlobalIndex(
  exam: ExamDefinition,
  questionId: string,
): number {
  const allIds = exam.sections.flatMap((s) => s.questionIds);
  return allIds.indexOf(questionId);
}

export function getSectionForQuestion(
  exam: ExamDefinition,
  questionId: string,
): string {
  for (const section of exam.sections) {
    if (section.questionIds.includes(questionId)) {
      return section.id;
    }
  }
  return exam.sections[0].id;
}

export function getQuestionTypeLabel(type: QuestionType): string {
  return type === "NUMERICAL" ? "Numerical Value Type" : "MCQ — Single Correct";
}
