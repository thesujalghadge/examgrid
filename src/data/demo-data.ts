import { DEMO_INSTITUTE } from "@/config/demo";
import type { ExamDefinition, ExamQuestion } from "@/types/exam";
import type { Batch, ExamSchedule, InstituteStudent } from "@/types/institute-ops";
import type { BankQuestion } from "@/types/question-bank";
import {
  type LegacyBankQuestion,
  withQuestionIntelligenceDefaults,
} from "@/lib/question-intelligence/defaults";

const base = Date.parse("2026-05-17T09:00:00.000Z");
const iso = (offsetHours: number) =>
  new Date(base + offsetHours * 60 * 60 * 1000).toISOString();
const ts = (offsetHours = 0) => base + offsetHours * 60 * 60 * 1000;

export const DEMO_BATCHES: Batch[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "JEE 2026 A",
    courseType: "JEE",
    academicYear: "2026",
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "NEET Repeaters",
    courseType: "NEET",
    academicYear: "2026",
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "CET Weekend Batch",
    courseType: "CET",
    academicYear: "2026",
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
];

export const DEMO_STUDENTS: InstituteStudent[] = [
  ["44444444-4444-4444-8444-444444444401", "Aarav Mehta", "aarav@cambridgeacademy.demo", "9876501001", "CAM-JEE-26001", "JEE", DEMO_BATCHES[0].id],
  ["44444444-4444-4444-8444-444444444402", "Diya Iyer", "diya@cambridgeacademy.demo", "9876501002", "CAM-JEE-26002", "JEE", DEMO_BATCHES[0].id],
  ["44444444-4444-4444-8444-444444444403", "Kabir Shah", "kabir@cambridgeacademy.demo", "9876501003", "CAM-NEET-26011", "NEET", DEMO_BATCHES[1].id],
  ["44444444-4444-4444-8444-444444444404", "Meera Nair", "meera@cambridgeacademy.demo", "9876501004", "CAM-NEET-26012", "NEET", DEMO_BATCHES[1].id],
  ["44444444-4444-4444-8444-444444444405", "Rohan Patil", "rohan@cambridgeacademy.demo", "9876501005", "CAM-CET-26021", "CET", DEMO_BATCHES[2].id],
].map(([id, fullName, email, phone, rollNumber, courseType, batchId]) => ({
  id,
  fullName,
  email,
  phone,
  rollNumber,
  courseType,
  batchId,
  active: true,
  createdAt: ts(),
  updatedAt: ts(),
}));

const DEMO_QUESTION_BANK_BASE = [
  {
    id: "demo-phy-kinematics-1",
    subject: "Physics",
    chapter: "Kinematics",
    topic: "Relative Motion",
    difficulty: "medium",
    questionType: "MCQ_SINGLE",
    questionText:
      "A train moving at 72 km/h crosses a platform in 18 s. If the train length is 180 m, find the platform length.",
    options: [
      { label: "A", text: "120 m" },
      { label: "B", text: "180 m" },
      { label: "C", text: "240 m" },
      { label: "D", text: "300 m" },
    ],
    correctAnswer: "B",
    solution: "72 km/h = 20 m/s. Total distance = 360 m, platform = 180 m.",
    marks: 4,
    negativeMarks: 1,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: "demo-phy-electro-1",
    subject: "Physics",
    chapter: "Electrostatics",
    topic: "Capacitance",
    difficulty: "hard",
    questionType: "NUMERICAL",
    questionText: "A 2 uF capacitor charged to 100 V stores energy in mJ. Enter the value.",
    options: [],
    correctAnswer: "10",
    solution: "Energy = 1/2 CV^2 = 0.01 J = 10 mJ.",
    marks: 4,
    negativeMarks: 0,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: "demo-chem-organic-1",
    subject: "Chemistry",
    chapter: "Organic Chemistry",
    topic: "GOC",
    difficulty: "medium",
    questionType: "MCQ_SINGLE",
    questionText: "Which effect explains electron release through sigma bonds?",
    options: [
      { label: "A", text: "Inductive effect" },
      { label: "B", text: "Mesomeric effect" },
      { label: "C", text: "Hyperconjugation" },
      { label: "D", text: "Steric effect" },
    ],
    correctAnswer: "A",
    solution: "Inductive effect operates through sigma bonds.",
    marks: 4,
    negativeMarks: 1,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: "demo-math-calculus-1",
    subject: "Mathematics",
    chapter: "Differential Calculus",
    topic: "Derivatives",
    difficulty: "easy",
    questionType: "NUMERICAL",
    questionText: "If f(x)=x^3, enter f'(2).",
    options: [],
    correctAnswer: "12",
    solution: "f'(x)=3x^2, so f'(2)=12.",
    marks: 4,
    negativeMarks: 0,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: "demo-bio-genetics-1",
    subject: "Biology",
    chapter: "Genetics",
    topic: "Mendelian Inheritance",
    difficulty: "medium",
    questionType: "MCQ_SINGLE",
    questionText: "A monohybrid cross gives which phenotypic ratio in F2 generation?",
    options: [
      { label: "A", text: "1:1" },
      { label: "B", text: "3:1" },
      { label: "C", text: "9:3:3:1" },
      { label: "D", text: "1:2:1" },
    ],
    correctAnswer: "B",
    solution: "Dominant to recessive phenotype appears in 3:1 ratio.",
    marks: 4,
    negativeMarks: 1,
    createdAt: ts(),
    updatedAt: ts(),
  },
] satisfies LegacyBankQuestion[];

export const DEMO_QUESTION_BANK: BankQuestion[] = DEMO_QUESTION_BANK_BASE.map(
  withQuestionIntelligenceDefaults,
);

function q(
  id: string,
  sectionId: string,
  number: number,
  text: string,
  type: "MCQ_SINGLE" | "NUMERICAL",
): ExamQuestion {
  if (type === "NUMERICAL") {
    return {
      id,
      sectionId,
      number,
      type,
      text,
      options: [],
      correctNumericalAnswer: number % 2 === 0 ? "12" : "10",
      marks: 4,
      negativeMarks: 0,
    };
  }
  const options = ["A", "B", "C", "D"].map((label) => ({
    id: `${id}-${label}`,
    label,
    text: `${label}) ${text.slice(0, 26)} option`,
  }));
  return {
    id,
    sectionId,
    number,
    type,
    text,
    options,
    correctOptionId: options[number % 4].id,
    marks: 4,
    negativeMarks: 1,
  };
}

function exam(
  id: string,
  title: string,
  examType: ExamDefinition["examType"],
  sectionNames: string[],
  scheduledAt: string,
): ExamDefinition {
  const questions: Record<string, ExamQuestion> = {};
  const sections = sectionNames.map((name, sIdx) => {
    const sectionId = name.toLowerCase().replace(/\s+/g, "-");
    const ids = [1, 2, 3, 4].map((num) => {
      const id2 = `${id}-${sectionId}-${num}`;
      questions[id2] = q(
        id2,
        sectionId,
        num,
        `${name} demo question ${num} for ${title}`,
        num === 4 ? "NUMERICAL" : "MCQ_SINGLE",
      );
      return id2;
    });
    void sIdx;
    return { id: sectionId, name, questionIds: ids };
  });
  return {
    id,
    title,
    subtitle: `${DEMO_INSTITUTE.name} scheduled CBT`,
    examType,
    durationMinutes: examType === "NEET" ? 200 : 90,
    totalQuestions: Object.keys(questions).length,
    scheduledAt,
    sections,
    questions,
    instructions: [
      "Read all instructions carefully before starting.",
      "The paper contains MCQ and Numerical Value Type questions.",
      "Do not switch tabs or exit fullscreen during the examination.",
      "Submit only after reviewing the question palette.",
    ],
  };
}

export const DEMO_EXAMS: ExamDefinition[] = [
  exam("demo-jee-live", "Cambridge Academy JEE Major Test 03", "JEE_MAIN", ["Physics", "Chemistry", "Mathematics"], iso(-1)),
  exam("demo-neet-upcoming", "NEET Repeaters Biology Drill", "NEET", ["Physics", "Chemistry", "Biology"], iso(48)),
  exam("demo-cet-completed", "CET Weekend Algebra Practice", "CET", ["Mathematics", "Logical Reasoning"], iso(-96)),
];

export const DEMO_SCHEDULES: ExamSchedule[] = [
  {
    id: "55555555-5555-4555-8555-555555555501",
    examId: "demo-jee-live",
    batchIds: [DEMO_BATCHES[0].id],
    startAt: iso(-2),
    endAt: iso(6),
    durationMinutes: 90,
    visibilityRule: "assigned_batches",
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: "55555555-5555-4555-8555-555555555502",
    examId: "demo-neet-upcoming",
    batchIds: [DEMO_BATCHES[1].id],
    startAt: iso(48),
    endAt: iso(56),
    durationMinutes: 200,
    visibilityRule: "assigned_batches",
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
  {
    id: "55555555-5555-4555-8555-555555555503",
    examId: "demo-cet-completed",
    batchIds: [DEMO_BATCHES[2].id],
    startAt: iso(-96),
    endAt: iso(-92),
    durationMinutes: 90,
    visibilityRule: "assigned_batches",
    active: true,
    createdAt: ts(),
    updatedAt: ts(),
  },
];

export const DEMO_LOGIN = {
  adminEmail: DEMO_INSTITUTE.adminEmail,
  adminPassword: "admin123",
  studentRoll: "CAM-JEE-26001",
  studentName: "Aarav Mehta",
  applicationNumber: "CAM-DEMO-2026-001",
};
