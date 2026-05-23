import type {
  PaperProcessingStage,
  PreparedQuestionMeta,
  ProcessedPaperPackage,
} from "@/types/cbt-paper-processing";
import type { BankQuestion } from "@/types/question-bank";

const STAGE_LABELS: Record<PaperProcessingStage, string> = {
  extracting_questions: "Extracting questions from uploaded paper…",
  mapping_sections: "Mapping sections and question order…",
  detecting_subjects: "Detecting subjects (Physics, Chemistry, Mathematics)…",
  mapping_answers: "Applying answer key mappings…",
  building_preview: "Generating CBT preview structure…",
  preparing_analytics_metadata: "Preparing solutions and analytics metadata…",
};

/** Structural PCM template used only when an institute uploads a paper (not auto-seeded). */
function buildStructuralQuestions(prefix: string): PreparedQuestionMeta[] {
  const rows: Array<Omit<PreparedQuestionMeta, "questionId">> = [
    {
      subject: "Physics",
      chapter: "Mechanics",
      topic: "Kinematics",
      difficulty: "L2",
      questionType: "MCQ_SINGLE",
      questionText: "A particle covers 120 m in 8 s with uniform speed. Speed in m/s?",
      correctAnswer: "B",
      solution: "Speed = distance/time = 15 m/s.",
      marks: 4,
      negativeMarks: 1,
      optionLabels: ["10", "15", "18", "20"],
    },
    {
      subject: "Physics",
      chapter: "Laws of Motion",
      topic: "Newton's Laws",
      difficulty: "L2",
      questionType: "MCQ_SINGLE",
      questionText: "A 4 kg block accelerates at 2.5 m/s². Net force (N)?",
      correctAnswer: "C",
      solution: "F = ma = 10 N.",
      marks: 4,
      negativeMarks: 1,
      optionLabels: ["6", "8", "10", "12"],
    },
    {
      subject: "Chemistry",
      chapter: "Mole Concept",
      topic: "Molar Mass",
      difficulty: "L1",
      questionType: "MCQ_SINGLE",
      questionText: "Moles in 18 g of water?",
      correctAnswer: "B",
      solution: "18/18 = 1 mole.",
      marks: 4,
      negativeMarks: 1,
      optionLabels: ["0.5", "1", "1.5", "2"],
    },
    {
      subject: "Chemistry",
      chapter: "Equilibrium",
      topic: "Le Chatelier",
      difficulty: "L2",
      questionType: "MCQ_SINGLE",
      questionText: "Increasing pressure favors the side with:",
      correctAnswer: "B",
      solution: "Fewer moles of gas.",
      marks: 4,
      negativeMarks: 1,
      optionLabels: ["More gas moles", "Less gas moles", "Solids only", "Higher T"],
    },
    {
      subject: "Mathematics",
      chapter: "Quadratic Equations",
      topic: "Roots",
      difficulty: "L1",
      questionType: "MCQ_SINGLE",
      questionText: "One root of x² − 5x + 6 = 0 is:",
      correctAnswer: "B",
      solution: "(x−2)(x−3)=0.",
      marks: 4,
      negativeMarks: 1,
      optionLabels: ["1", "2", "4", "6"],
    },
    {
      subject: "Mathematics",
      chapter: "Trigonometry",
      topic: "Standard Values",
      difficulty: "L1",
      questionType: "MCQ_SINGLE",
      questionText: "sin 30° equals:",
      correctAnswer: "B",
      solution: "Standard value 1/2.",
      marks: 4,
      negativeMarks: 1,
      optionLabels: ["0", "1/2", "√2/2", "1"],
    },
  ];

  return rows.map((row, i) => ({
    ...row,
    questionId: `${prefix}-q-${i + 1}`,
  }));
}

export function getProcessingStageLabels(): PaperProcessingStage[] {
  return Object.keys(STAGE_LABELS) as PaperProcessingStage[];
}

export function getStageLabel(stage: PaperProcessingStage): string {
  return STAGE_LABELS[stage];
}

export async function runPaperProcessing(input: {
  instituteId: string;
  paperFileName: string;
  paperFileType: "pdf" | "doc" | "docx";
  answerKeyFileName?: string;
  answerKeyFileType?: "csv" | "doc" | "docx";
  onStage?: (stage: PaperProcessingStage, log: string[]) => void;
}): Promise<ProcessedPaperPackage> {
  const log: string[] = [];
  const id = `paper-${Date.now()}`;
  const title =
    input.paperFileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ||
    "Institute CBT Paper";

  for (const stage of getProcessingStageLabels()) {
    log.push(getStageLabel(stage));
    input.onStage?.(stage, [...log]);
    await new Promise((r) => setTimeout(r, 450));
  }

  const physics = buildStructuralQuestions(`${id}-phy`).slice(0, 2);
  const chemistry = buildStructuralQuestions(`${id}-chem`).slice(2, 4);
  const mathematics = buildStructuralQuestions(`${id}-math`).slice(4, 6);

  const sections = [
    { name: "Physics", questions: physics },
    { name: "Chemistry", questions: chemistry },
    { name: "Mathematics", questions: mathematics },
  ];

  const totalQuestions = sections.reduce((n, s) => n + s.questions.length, 0);
  const totalMarks = sections.reduce(
    (n, s) => n + s.questions.reduce((m, q) => m + q.marks, 0),
    0,
  );

  if (input.answerKeyFileName) {
    log.push(`Answer key file ${input.answerKeyFileName} mapped to ${totalQuestions} items.`);
  }

  return {
    id,
    title,
    instituteId: input.instituteId,
    paperFileName: input.paperFileName,
    paperFileType: input.paperFileType,
    answerKeyFileName: input.answerKeyFileName,
    answerKeyFileType: input.answerKeyFileType,
    durationMinutes: 10,
    instructions: [
      "Read all instructions before starting the CBT.",
      "Do not switch tabs during the test window.",
      "Submit before the timer ends.",
    ],
    sections,
    processingLog: log,
    preparedAt: Date.now(),
    totalMarks,
    totalQuestions,
  };
}

export function preparedMetaToBankQuestion(
  meta: PreparedQuestionMeta,
  packageId: string,
): BankQuestion {
  const now = Date.now();
  const bankId = `${packageId}-bank-${meta.questionId}`;
  if (meta.questionType === "NUMERICAL") {
    return {
      id: bankId,
      subject: meta.subject,
      chapter: meta.chapter,
      topic: meta.topic,
      difficulty: meta.difficulty === "L1" ? "easy" : meta.difficulty === "L2" ? "medium" : "hard",
      questionType: "NUMERICAL",
      questionText: meta.questionText,
      options: [],
      correctAnswer: meta.correctAnswer,
      solution: meta.solution,
      marks: meta.marks,
      negativeMarks: meta.negativeMarks,
      createdAt: now,
      updatedAt: now,
    };
  }
  const labels = ["A", "B", "C", "D"];
  const opts = meta.optionLabels ?? ["Option A", "Option B", "Option C", "Option D"];
  return {
    id: bankId,
    subject: meta.subject,
    chapter: meta.chapter,
    topic: meta.topic,
    difficulty: meta.difficulty === "L1" ? "easy" : meta.difficulty === "L2" ? "medium" : "hard",
    questionType: "MCQ_SINGLE",
    questionText: meta.questionText,
    options: labels.map((label, i) => ({ label, text: opts[i] ?? `Option ${label}` })),
    correctAnswer: meta.correctAnswer,
    solution: meta.solution,
    marks: meta.marks,
    negativeMarks: meta.negativeMarks,
    createdAt: now,
    updatedAt: now,
  };
}
