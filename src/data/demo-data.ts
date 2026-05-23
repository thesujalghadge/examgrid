import { DEMO_INSTITUTE } from "@/config/demo";
import type { CBTTest, CBTTestQuestion, CBTTestSection, CbtFinalAttempt } from "@/types/cbt";
import type { PersistedExamAttempt, ExamResult, SectionScore } from "@/types/exam";
import type { Batch, ExamSchedule, InstituteStudent } from "@/types/institute-ops";
import type { BankQuestion } from "@/types/question-bank";
import type { TestQuestionResult, TestSession, TestResultBreakdown } from "@/types/test-session";

export const DEMO_ENV_VERSION = "cambridge-academy-v2";

export interface DemoStudentAccount {
  studentId: string;
  fullName: string;
  email: string;
  rollNumber: string;
  applicationNumber: string;
  batchId: string;
  password: string;
  parentEmail: string;
}

export interface DemoParentAccount {
  email: string;
  parentName: string;
  relation: string;
  studentRollNumber: string;
  password: string;
  attendancePercentage: number;
  latestAttendanceNote: string;
}

export interface DemoPaperTemplate {
  id: string;
  title: string;
  sourceFileName: string;
  sourceFileType: "pdf" | "doc" | "docx";
  durationMinutes: number;
  instructions: string[];
  sections: Array<{
    name: string;
    questionBankIds: string[];
  }>;
}

export interface CambridgeDemoSeed {
  questionBank: BankQuestion[];
  batches: Batch[];
  students: InstituteStudent[];
  tests: CBTTest[];
  schedules: ExamSchedule[];
  cbtAttempts: CbtFinalAttempt[];
  testSessions: TestSession[];
  persistedAttempts: PersistedExamAttempt[];
}

const now = () => Date.now();
const ts = (minutesOffset = 0) => now() + minutesOffset * 60 * 1000;
const iso = (minutesOffset = 0) => new Date(ts(minutesOffset)).toISOString();

export const DEMO_PLATFORM_ADMIN = {
  email: "admin@examgrid.ai",
  password: "admin123",
} as const;

export const DEMO_INSTITUTE_LOGIN = {
  email: DEMO_INSTITUTE.adminEmail,
  password: "admin123",
} as const;

export const DEMO_BATCHES: Batch[] = [
  {
    id: "batch-cambridge-pcm-morning",
    instituteId: DEMO_INSTITUTE.id,
    name: "JEE Main PCM Morning Batch",
    courseType: "JEE",
    academicYear: "2026",
    active: true,
    createdAt: ts(-7 * 24 * 60),
    updatedAt: ts(-7 * 24 * 60),
  },
  {
    id: "batch-cambridge-pcm-evening",
    instituteId: DEMO_INSTITUTE.id,
    name: "JEE Advanced PCM Evening Batch",
    courseType: "JEE",
    academicYear: "2026",
    active: true,
    createdAt: ts(-7 * 24 * 60),
    updatedAt: ts(-7 * 24 * 60),
  },
];

export const DEMO_STUDENT_ACCOUNTS: DemoStudentAccount[] = [
  {
    studentId: "student-cam-001",
    fullName: "Yash Sawant",
    email: "yash.sawant@cambridgeacademy.in",
    rollNumber: "CA-JEE-26001",
    applicationNumber: "CA2026A001",
    batchId: DEMO_BATCHES[0].id,
    password: "admin123",
    parentEmail: "sandeep.sawant@cambridgeacademy.in",
  },
  {
    studentId: "student-cam-002",
    fullName: "Ajay Mali",
    email: "ajay.mali@cambridgeacademy.in",
    rollNumber: "CA-JEE-26002",
    applicationNumber: "CA2026A002",
    batchId: DEMO_BATCHES[0].id,
    password: "admin123",
    parentEmail: "rekha.mali@cambridgeacademy.in",
  },
  {
    studentId: "student-cam-003",
    fullName: "Anuj Verma",
    email: "anuj.verma@cambridgeacademy.in",
    rollNumber: "CA-JEE-26003",
    applicationNumber: "CA2026A003",
    batchId: DEMO_BATCHES[1].id,
    password: "admin123",
    parentEmail: "vinod.verma@cambridgeacademy.in",
  },
  {
    studentId: "student-cam-004",
    fullName: "Siddhant Satpute",
    email: "siddhant.satpute@cambridgeacademy.in",
    rollNumber: "CA-JEE-26004",
    applicationNumber: "CA2026A004",
    batchId: DEMO_BATCHES[1].id,
    password: "admin123",
    parentEmail: "manisha.satpute@cambridgeacademy.in",
  },
  {
    studentId: "student-cam-005",
    fullName: "Prashik Chopade",
    email: "prashik.chopade@cambridgeacademy.in",
    rollNumber: "CA-JEE-26005",
    applicationNumber: "CA2026A005",
    batchId: DEMO_BATCHES[0].id,
    password: "admin123",
    parentEmail: "suresh.chopade@cambridgeacademy.in",
  },
];

export const DEMO_STUDENTS: InstituteStudent[] = DEMO_STUDENT_ACCOUNTS.map((account, index) => ({
  id: account.studentId,
  instituteId: DEMO_INSTITUTE.id,
  fullName: account.fullName,
  email: account.email,
  phone: `98980${(12000 + index).toString()}`,
  rollNumber: account.rollNumber,
  courseType: "JEE",
  batchId: account.batchId,
  active: true,
  createdAt: ts(-6 * 24 * 60),
  updatedAt: ts(-6 * 24 * 60),
}));

export const DEMO_PARENT_ACCOUNTS: DemoParentAccount[] = [
  {
    email: "sandeep.sawant@cambridgeacademy.in",
    parentName: "Sandeep Sawant",
    relation: "Father",
    studentRollNumber: "CA-JEE-26001",
    password: "admin123",
    attendancePercentage: 94,
    latestAttendanceNote: "Present in morning PCM classes this week.",
  },
  {
    email: "rekha.mali@cambridgeacademy.in",
    parentName: "Rekha Mali",
    relation: "Mother",
    studentRollNumber: "CA-JEE-26002",
    password: "admin123",
    attendancePercentage: 91,
    latestAttendanceNote: "Attended doubt-solving and chemistry revision.",
  },
  {
    email: "vinod.verma@cambridgeacademy.in",
    parentName: "Vinod Verma",
    relation: "Father",
    studentRollNumber: "CA-JEE-26003",
    password: "admin123",
    attendancePercentage: 88,
    latestAttendanceNote: "Missed one evening mathematics lecture.",
  },
  {
    email: "manisha.satpute@cambridgeacademy.in",
    parentName: "Manisha Satpute",
    relation: "Mother",
    studentRollNumber: "CA-JEE-26004",
    password: "admin123",
    attendancePercentage: 96,
    latestAttendanceNote: "Full attendance in the last two classroom sessions.",
  },
  {
    email: "suresh.chopade@cambridgeacademy.in",
    parentName: "Suresh Chopade",
    relation: "Father",
    studentRollNumber: "CA-JEE-26005",
    password: "admin123",
    attendancePercentage: 89,
    latestAttendanceNote: "Present for physics; late once for mathematics.",
  },
];

function mcq(
  id: string,
  subject: string,
  chapter: string,
  topic: string,
  difficulty: "easy" | "medium" | "hard",
  questionText: string,
  options: [string, string, string, string],
  correctAnswer: "A" | "B" | "C" | "D",
  solution: string,
): BankQuestion {
  return {
    id,
    subject,
    chapter,
    topic,
    difficulty,
    questionType: "MCQ_SINGLE",
    questionText,
    options: [
      { label: "A", text: options[0] },
      { label: "B", text: options[1] },
      { label: "C", text: options[2] },
      { label: "D", text: options[3] },
    ],
    correctAnswer,
    solution,
    marks: 4,
    negativeMarks: 1,
    createdAt: ts(-5 * 24 * 60),
    updatedAt: ts(-5 * 24 * 60),
  };
}

function numerical(
  id: string,
  subject: string,
  chapter: string,
  topic: string,
  difficulty: "easy" | "medium" | "hard",
  questionText: string,
  correctAnswer: string,
  solution: string,
): BankQuestion {
  return {
    id,
    subject,
    chapter,
    topic,
    difficulty,
    questionType: "NUMERICAL",
    questionText,
    options: [],
    correctAnswer,
    solution,
    marks: 4,
    negativeMarks: 0,
    createdAt: ts(-5 * 24 * 60),
    updatedAt: ts(-5 * 24 * 60),
  };
}

export const DEMO_QUESTION_BANK: BankQuestion[] = [
  mcq(
    "cam-phy-01",
    "Physics",
    "Kinematics",
    "Relative Motion",
    "medium",
    "A car covers 180 m in 10 s with uniform speed. What is the speed in m/s?",
    ["12", "15", "18", "20"],
    "C",
    "Speed = distance / time = 180 / 10 = 18 m/s.",
  ),
  mcq(
    "cam-phy-02",
    "Physics",
    "Laws of Motion",
    "Force",
    "medium",
    "A 5 kg block accelerates at 2 m/s^2 on a frictionless surface. Net force is:",
    ["5 N", "7 N", "10 N", "12 N"],
    "C",
    "Use F = ma = 5 x 2 = 10 N.",
  ),
  numerical(
    "cam-phy-03",
    "Physics",
    "Work, Power and Energy",
    "Kinetic Energy",
    "easy",
    "A 2 kg body moves at 3 m/s. Enter its kinetic energy in joules.",
    "9",
    "Kinetic energy = 1/2 x 2 x 3^2 = 9 J.",
  ),
  mcq(
    "cam-phy-04",
    "Physics",
    "Current Electricity",
    "Ohm's Law",
    "easy",
    "A resistor of 4 ohm carries 3 A current. Potential difference across it is:",
    ["7 V", "12 V", "16 V", "20 V"],
    "B",
    "V = IR = 3 x 4 = 12 V.",
  ),
  numerical(
    "cam-phy-05",
    "Physics",
    "Electrostatics",
    "Capacitance",
    "medium",
    "A 2 microfarad capacitor is charged to 100 V. Enter stored energy in millijoules.",
    "10",
    "Energy = 1/2 CV^2 = 10 mJ.",
  ),
  mcq(
    "cam-chem-01",
    "Chemistry",
    "Mole Concept",
    "Atomic Mass",
    "easy",
    "How many moles are present in 18 g of water?",
    ["0.5", "1", "1.5", "2"],
    "B",
    "Moles = mass / molar mass = 18 / 18 = 1.",
  ),
  mcq(
    "cam-chem-02",
    "Chemistry",
    "Atomic Structure",
    "Bohr Model",
    "medium",
    "Maximum electrons in M-shell is:",
    ["8", "18", "32", "50"],
    "B",
    "For n = 3, maximum electrons = 2n^2 = 18.",
  ),
  numerical(
    "cam-chem-03",
    "Chemistry",
    "Chemical Bonding",
    "Sigma Bonds",
    "medium",
    "Methane has how many sigma bonds? Enter the number.",
    "4",
    "CH4 contains four C-H sigma bonds.",
  ),
  mcq(
    "cam-chem-04",
    "Chemistry",
    "Equilibrium",
    "Le Chatelier Principle",
    "medium",
    "Increasing pressure favors the side with:",
    ["More gas moles", "Less gas moles", "No solids", "Higher temperature"],
    "B",
    "Pressure increase shifts equilibrium towards fewer moles of gas.",
  ),
  numerical(
    "cam-chem-05",
    "Chemistry",
    "Redox Reactions",
    "Oxidation Number",
    "hard",
    "Enter the oxidation number of sulfur in H2SO4.",
    "6",
    "2(+1) + S + 4(-2) = 0 gives S = +6.",
  ),
  mcq(
    "cam-math-01",
    "Mathematics",
    "Quadratic Equations",
    "Roots",
    "easy",
    "If x^2 - 5x + 6 = 0, one root is:",
    ["1", "2", "4", "6"],
    "B",
    "Factorize as (x-2)(x-3)=0.",
  ),
  numerical(
    "cam-math-02",
    "Mathematics",
    "Sequences and Series",
    "Arithmetic Progression",
    "easy",
    "The 10th term of the AP 3, 5, 7, ... is:",
    "21",
    "a10 = 3 + 9 x 2 = 21.",
  ),
  mcq(
    "cam-math-03",
    "Mathematics",
    "Trigonometry",
    "Standard Values",
    "easy",
    "sin 30 degrees is:",
    ["0", "1/2", "sqrt(2)/2", "1"],
    "B",
    "Standard value of sin 30 degrees is 1/2.",
  ),
  mcq(
    "cam-math-04",
    "Mathematics",
    "Differentiation",
    "Derivatives",
    "medium",
    "The derivative of x^3 is:",
    ["x^2", "2x", "3x^2", "3x"],
    "C",
    "Use power rule d/dx (x^n) = nx^(n-1).",
  ),
  numerical(
    "cam-math-05",
    "Mathematics",
    "Coordinate Geometry",
    "Distance Formula",
    "medium",
    "Distance between (0,0) and (3,4) is:",
    "5",
    "Distance = sqrt(3^2 + 4^2) = 5.",
  ),
];

export const DEMO_PAPER_TEMPLATES: DemoPaperTemplate[] = [
  {
    id: "cambridge-pcm-benchmark-01",
    title: "Cambridge PCM Benchmark 01",
    sourceFileName: "Cambridge_PCM_Benchmark_01.docx",
    sourceFileType: "docx",
    durationMinutes: 8,
    instructions: [
      "Attempt all questions in sequence.",
      "Do not leave the CBT window during the benchmark.",
      "Use the question palette only for navigation and review.",
    ],
    sections: [
      { name: "Physics", questionBankIds: ["cam-phy-01", "cam-phy-02", "cam-phy-03"] },
      { name: "Chemistry", questionBankIds: ["cam-chem-01", "cam-chem-02", "cam-chem-03"] },
      { name: "Mathematics", questionBankIds: ["cam-math-01", "cam-math-02", "cam-math-03"] },
    ],
  },
  {
    id: "cambridge-weekly-pcm-live-01",
    title: "LIVE — Weekly PCM Test (Physics · Chemistry · Mathematics)",
    sourceFileName: "Cambridge_Weekly_PCM_Test_01.pdf",
    sourceFileType: "pdf",
    durationMinutes: 10,
    instructions: [
      "This is the live weekly CBT for Cambridge Academy PCM batches.",
      "The paper contains Physics, Chemistry, and Mathematics sections with 5 questions each.",
      "Submit the test before the timer reaches zero.",
      "Students should remain in fullscreen mode for the full duration.",
    ],
    sections: [
      {
        name: "Physics",
        questionBankIds: ["cam-phy-01", "cam-phy-02", "cam-phy-03", "cam-phy-04", "cam-phy-05"],
      },
      {
        name: "Chemistry",
        questionBankIds: ["cam-chem-01", "cam-chem-02", "cam-chem-03", "cam-chem-04", "cam-chem-05"],
      },
      {
        name: "Mathematics",
        questionBankIds: ["cam-math-01", "cam-math-02", "cam-math-03", "cam-math-04", "cam-math-05"],
      },
    ],
  },
];

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function buildCbtTestFromTemplate(
  template: DemoPaperTemplate,
  batchIds: string[],
  createdBy: string,
  createdAt: number,
): CBTTest {
  const sections: CBTTestSection[] = [];
  const questions: CBTTestQuestion[] = [];
  let totalMarks = 0;
  let questionCount = 0;

  template.sections.forEach((section, sectionIndex) => {
    const sectionId = `${template.id}-${slug(section.name)}`;
    sections.push({
      id: sectionId,
      testId: template.id,
      name: section.name,
      order: sectionIndex,
    });

    section.questionBankIds.forEach((questionBankId) => {
      questionCount += 1;
      const bankQuestion = DEMO_QUESTION_BANK.find((question) => question.id === questionBankId);
      if (!bankQuestion) return;
      totalMarks += bankQuestion.marks;
      questions.push({
        id: `${template.id}-row-${questionCount}`,
        testId: template.id,
        sectionId,
        questionId: `${template.id}-question-${questionCount}`,
        source: "bank",
        bankQuestionId: questionBankId,
        questionType: bankQuestion.questionType,
        marks: bankQuestion.marks,
        negativeMarks: bankQuestion.negativeMarks,
      });
    });
  });

  return {
    id: template.id,
    title: template.title,
    instituteId: DEMO_INSTITUTE.id,
    durationMinutes: template.durationMinutes,
    totalMarks,
    createdBy,
    sections,
    questions,
    batchIds,
    createdAt,
    updatedAt: createdAt,
    instructions: template.instructions,
    sourceFileName: template.sourceFileName,
    sourceFileType: template.sourceFileType,
    sourceImportedAt: createdAt,
  };
}

function getWrongValue(question: BankQuestion): string {
  if (question.questionType === "NUMERICAL") {
    const numeric = Number(question.correctAnswer);
    return Number.isFinite(numeric) ? String(numeric + 1) : "0";
  }

  const labels = ["A", "B", "C", "D"];
  return labels.find((label) => label !== question.correctAnswer) ?? "A";
}

function buildTestSubmission(
  test: CBTTest,
  student: DemoStudentAccount,
  plan: Array<"C" | "W" | "S">,
  startedAt: number,
  durationSeconds: number,
): {
  cbtAttempt: CbtFinalAttempt;
  testSession: TestSession;
  persistedAttempt: PersistedExamAttempt;
} {
  const bankById = new Map(DEMO_QUESTION_BANK.map((question) => [question.id, question]));
  const sectionNameById = new Map(test.sections.map((section) => [section.id, section.name]));
  const questionRows = [...test.questions].sort((a, b) => a.questionId.localeCompare(b.questionId));
  const submittedAt = startedAt + durationSeconds * 1000;

  const responses: CbtFinalAttempt["responses"] = [];
  const perQuestion: TestQuestionResult[] = [];
  const answerMap: Record<string, string | null> = {};

  let correct = 0;
  let incorrect = 0;
  let attempted = 0;
  let rawScore = 0;

  questionRows.forEach((row, index) => {
    const bankQuestion = row.bankQuestionId ? bankById.get(row.bankQuestionId) : undefined;
    if (!bankQuestion) return;
    const outcome = plan[index] ?? "S";
    const selected =
      outcome === "S"
        ? null
        : outcome === "C"
          ? bankQuestion.correctAnswer
          : getWrongValue(bankQuestion);
    const isCorrect = selected != null && selected === bankQuestion.correctAnswer;
    const marksAwarded =
      selected == null ? 0 : isCorrect ? row.marks : -row.negativeMarks;

    if (selected != null) attempted += 1;
    if (isCorrect) correct += 1;
    if (selected != null && !isCorrect) incorrect += 1;
    rawScore += marksAwarded;

    answerMap[row.questionId] = selected;
    responses.push({
      id: `${test.id}-${student.rollNumber}-response-${index + 1}`,
      attemptId: `${test.id}-${student.rollNumber}-attempt`,
      questionId: row.questionId,
      selectedOption: selected,
      isCorrect,
    });
    perQuestion.push({
      questionId: row.questionId,
      selected,
      correct: isCorrect,
      marksAwarded,
      maxMarks: row.marks,
    });
  });

  const unattempted = questionRows.length - attempted;
  const maxScore = questionRows.reduce((sum, row) => sum + row.marks, 0);
  const resultBreakdown: TestResultBreakdown = {
    correct,
    incorrect,
    unattempted,
    attempted,
    maxScore,
    rawScore,
    integrityPenalty: 0,
    finalScore: rawScore,
    durationSeconds,
    perQuestion,
  };

  const sectionScores: SectionScore[] = test.sections.map((section) => {
    const rows = questionRows.filter((row) => row.sectionId === section.id);
    const rowIds = new Set(rows.map((row) => row.questionId));
    const breakdownRows = perQuestion.filter((entry) => rowIds.has(entry.questionId));
    const attemptedCount = breakdownRows.filter((entry) => entry.selected != null).length;
    const correctCount = breakdownRows.filter((entry) => entry.correct).length;
    const incorrectCount = breakdownRows.filter(
      (entry) => entry.selected != null && !entry.correct,
    ).length;
    const score = breakdownRows.reduce((sum, entry) => sum + entry.marksAwarded, 0);

    return {
      sectionId: section.id,
      sectionName: sectionNameById.get(section.id) ?? section.name,
      total: rows.length,
      attempted: attemptedCount,
      correct: correctCount,
      incorrect: incorrectCount,
      unattempted: rows.length - attemptedCount,
      score,
    };
  });

  const examResult: ExamResult = {
    examId: test.id,
    examTitle: test.title,
    candidateName: student.fullName,
    rollNumber: student.rollNumber,
    submittedAt,
    durationUsedSeconds: durationSeconds,
    totalQuestions: questionRows.length,
    attempted,
    correct,
    incorrect,
    unattempted,
    totalScore: rawScore,
    maxScore,
    sectionScores,
    violationCount: 0,
  };

  return {
    cbtAttempt: {
      attempt: {
        id: `${test.id}-${student.rollNumber}-attempt`,
        testId: test.id,
        studentId: student.rollNumber,
        instituteId: DEMO_INSTITUTE.id,
        startedAt,
        submittedAt,
        score: rawScore,
      },
      responses,
    },
    testSession: {
      id: `${test.id}-${student.rollNumber}-session`,
      studentId: student.rollNumber,
      testId: test.id,
      instituteId: DEMO_INSTITUTE.id,
      status: "submitted",
      startedAt,
      endsAt: startedAt + test.durationMinutes * 60 * 1000,
      answers: answerMap,
      lastSavedAt: submittedAt,
      currentQuestionId: questionRows[0]?.questionId,
      currentSectionId: test.sections[0]?.id,
      markedForReview: {},
      visited: Object.fromEntries(questionRows.map((row) => [row.questionId, true])),
      questionOrder: questionRows.map((row) => row.questionId),
      optionOrderMap: {},
      integrityEvents: [],
      integrityScore: 100,
      flagged: false,
      score: rawScore,
      resultBreakdown,
    },
    persistedAttempt: {
      version: 1,
      examId: test.id,
      candidateRoll: student.rollNumber,
      lifecycle: "submitted",
      examEndsAt: startedAt + test.durationMinutes * 60 * 1000,
      startedAt,
      currentQuestionId: questionRows[0]?.questionId ?? "",
      currentSectionId: test.sections[0]?.id ?? "",
      answers: answerMap,
      visited: Object.fromEntries(questionRows.map((row) => [row.questionId, true])),
      markedForReview: {},
      violations: [],
      submittedAt,
      result: examResult,
    },
  };
}

export function createCambridgeDemoSeed(): CambridgeDemoSeed {
  const benchmarkTest = buildCbtTestFromTemplate(
    DEMO_PAPER_TEMPLATES[0],
    DEMO_BATCHES.map((batch) => batch.id),
    DEMO_INSTITUTE_LOGIN.email,
    ts(-24 * 60),
  );

  const liveTest = buildCbtTestFromTemplate(
    DEMO_PAPER_TEMPLATES[1],
    DEMO_BATCHES.map((batch) => batch.id),
    DEMO_INSTITUTE_LOGIN.email,
    ts(-90),
  );

  const schedules: ExamSchedule[] = [
    {
      id: "schedule-cambridge-benchmark-01",
      instituteId: DEMO_INSTITUTE.id,
      examId: benchmarkTest.id,
      batchIds: DEMO_BATCHES.map((batch) => batch.id),
      startAt: iso(-24 * 60),
      endAt: iso(-24 * 60 + 120),
      durationMinutes: benchmarkTest.durationMinutes,
      visibilityRule: "assigned_batches",
      active: true,
      createdAt: ts(-24 * 60),
      updatedAt: ts(-24 * 60),
    },
    {
      id: "schedule-cambridge-live-01",
      instituteId: DEMO_INSTITUTE.id,
      examId: liveTest.id,
      batchIds: DEMO_BATCHES.map((batch) => batch.id),
      startAt: iso(-30),
      endAt: iso(180),
      durationMinutes: liveTest.durationMinutes,
      visibilityRule: "assigned_batches",
      active: true,
      createdAt: ts(-60),
      updatedAt: ts(-60),
    },
  ];

  const benchmarkPlans: Record<string, Array<"C" | "W" | "S">> = {
    "CA-JEE-26001": ["C", "C", "C", "C", "W", "C", "C", "C", "S"],
    "CA-JEE-26002": ["C", "W", "C", "C", "C", "S", "C", "W", "C"],
    "CA-JEE-26003": ["W", "C", "C", "S", "C", "W", "C", "C", "S"],
    "CA-JEE-26004": ["C", "C", "S", "C", "C", "C", "W", "C", "C"],
    "CA-JEE-26005": ["C", "W", "S", "C", "W", "C", "S", "C", "W"],
  };

  const durations: Record<string, number> = {
    "CA-JEE-26001": 372,
    "CA-JEE-26002": 421,
    "CA-JEE-26003": 458,
    "CA-JEE-26004": 339,
    "CA-JEE-26005": 487,
  };

  const benchmarkSubmissions = DEMO_STUDENT_ACCOUNTS.map((student, index) =>
    buildTestSubmission(
      benchmarkTest,
      student,
      benchmarkPlans[student.rollNumber],
      ts(-24 * 60 + 15 + index * 3),
      durations[student.rollNumber],
    ),
  );

  const livePlans: Record<string, Array<"C" | "W" | "S">> = {
    "CA-JEE-26001": [
      "C", "C", "C", "C", "C", "W", "C", "C", "C", "C", "S", "C", "W", "C", "C",
    ],
    "CA-JEE-26002": [
      "C", "W", "C", "C", "C", "C", "S", "C", "W", "C", "C", "C", "W", "C", "S",
    ],
  };

  const liveDurations: Record<string, number> = {
    "CA-JEE-26001": 498,
    "CA-JEE-26002": 521,
  };

  const liveSubmissions = DEMO_STUDENT_ACCOUNTS.filter(
    (s) => livePlans[s.rollNumber],
  ).map((student, index) =>
    buildTestSubmission(
      liveTest,
      student,
      livePlans[student.rollNumber],
      ts(-12 + index * 4),
      liveDurations[student.rollNumber],
    ),
  );

  const allSubmissions = [...benchmarkSubmissions, ...liveSubmissions];

  return {
    questionBank: DEMO_QUESTION_BANK,
    batches: DEMO_BATCHES,
    students: DEMO_STUDENTS,
    tests: [benchmarkTest, liveTest],
    schedules,
    cbtAttempts: allSubmissions.map((submission) => submission.cbtAttempt),
    testSessions: allSubmissions.map((submission) => submission.testSession),
    persistedAttempts: allSubmissions.map((submission) => submission.persistedAttempt),
  };
}

export function getStudentAccount(identifier: string): DemoStudentAccount | undefined {
  const normalized = identifier.trim().toLowerCase();
  return DEMO_STUDENT_ACCOUNTS.find(
    (account) =>
      account.rollNumber.trim().toLowerCase() === normalized ||
      account.email.trim().toLowerCase() === normalized,
  );
}

export function getParentAccountByEmail(email: string): DemoParentAccount | undefined {
  const normalized = email.trim().toLowerCase();
  return DEMO_PARENT_ACCOUNTS.find((account) => account.email.toLowerCase() === normalized);
}

export function getParentAccountByStudentRoll(
  rollNumber: string,
): DemoParentAccount | undefined {
  const normalized = rollNumber.trim().toLowerCase();
  return DEMO_PARENT_ACCOUNTS.find(
    (account) => account.studentRollNumber.trim().toLowerCase() === normalized,
  );
}

export function getLivePaperTemplate(): DemoPaperTemplate {
  return DEMO_PAPER_TEMPLATES[1];
}

export function simulatePaperProcessing(
  fileName: string,
  _mimeType?: string,
  answerKeyFileName?: string,
): DemoPaperTemplate {
  const lower = fileName.toLowerCase();
  const extension = lower.endsWith(".doc")
    ? "doc"
    : lower.endsWith(".docx")
      ? "docx"
      : "pdf";
  const template = getLivePaperTemplate();
  const baseTitle =
    fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || template.title;
  const keyNote = answerKeyFileName
    ? `Answer key merged from ${answerKeyFileName}.`
    : "Default answer key from institute question bank applied.";
  return {
    ...template,
    id: `upload-${slug(baseTitle)}-${Date.now()}`,
    sourceFileName: fileName,
    sourceFileType: extension,
    title: baseTitle,
    instructions: [`Paper processed from ${fileName}.`, keyNote, ...template.instructions.slice(1)],
  };
}

export const DEMO_LOGIN = {
  platformEmail: DEMO_PLATFORM_ADMIN.email,
  instituteEmail: DEMO_INSTITUTE_LOGIN.email,
  adminPassword: "admin123",
  studentRoll: DEMO_STUDENT_ACCOUNTS[0].rollNumber,
  studentPassword: "admin123",
  studentName: DEMO_STUDENT_ACCOUNTS[0].fullName,
  applicationNumber: DEMO_STUDENT_ACCOUNTS[0].applicationNumber,
  parentEmail: DEMO_PARENT_ACCOUNTS[0].email,
  parentPassword: "admin123",
};
