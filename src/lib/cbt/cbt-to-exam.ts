import { getQuestionBank } from "@/services/question-bank-service";
import type { BankQuestion } from "@/types/question-bank";
import type { ExamDefinition, ExamQuestion, ExamSection } from "@/types/exam";
import type { CBTTest, CBTTestQuestion } from "@/types/cbt";

function bankToExamQuestion(
  bank: BankQuestion,
  sectionId: string,
  examQuestionId: string,
  order: number,
  marks: number,
  negativeMarks: number,
): ExamQuestion {
  if (bank.questionType === "NUMERICAL") {
    return {
      id: examQuestionId,
      sectionId,
      number: order,
      type: "NUMERICAL",
      text: bank.questionText,
      options: [],
      correctNumericalAnswer: bank.correctAnswer,
      marks,
      negativeMarks,
    };
  }
  const options = bank.options.map((opt) => ({
    id: `${examQuestionId}-opt-${opt.label}`,
    label: opt.label,
    text: opt.text,
  }));
  const correctOption =
    options.find(
      (o) =>
        o.label === bank.correctAnswer || o.id === bank.correctAnswer,
    ) ?? options[0];
  return {
    id: examQuestionId,
    sectionId,
    number: order,
    type: "MCQ_SINGLE",
    text: bank.questionText,
    options,
    correctOptionId: correctOption?.id,
    marks,
    negativeMarks,
  };
}

function manualToExamQuestion(
  manual: NonNullable<CBTTestQuestion["manual"]>,
  sectionId: string,
  examQuestionId: string,
  order: number,
  marks: number,
  negativeMarks: number,
): ExamQuestion {
  const options = manual.options.map((opt) => ({
    id: `${examQuestionId}-opt-${opt.label}`,
    label: opt.label,
    text: opt.text,
  }));
  const correct = options.find((o) => o.label === manual.correctLabel) ?? options[0];
  return {
    id: examQuestionId,
    sectionId,
    number: order,
    type: "MCQ_SINGLE",
    text: manual.text,
    options,
    correctOptionId: correct?.id,
    marks,
    negativeMarks,
  };
}

export function cbtTestToExamDefinition(test: CBTTest): ExamDefinition | null {
  const bankById = new Map(getQuestionBank().map((q) => [q.id, q]));
  const orderedSections = [...test.sections].sort((a, b) => a.order - b.order);
  if (orderedSections.length === 0 || test.questions.length === 0) return null;

  const questions: Record<string, ExamQuestion> = {};
  const sections: ExamSection[] = orderedSections.map((sec) => ({
    id: sec.id,
    name: sec.name,
    questionIds: [] as string[],
  }));
  const sectionIndex = new Map(sections.map((s) => [s.id, s]));

  const bySection = new Map<string, CBTTestQuestion[]>();
  for (const q of test.questions) {
    const list = bySection.get(q.sectionId) ?? [];
    list.push(q);
    bySection.set(q.sectionId, list);
  }

  for (const sec of orderedSections) {
    const examSec = sectionIndex.get(sec.id);
    if (!examSec) continue;
    const rows = (bySection.get(sec.id) ?? []).slice();
    rows.sort((a, b) => a.questionId.localeCompare(b.questionId));
    let num = 0;
    for (const row of rows) {
      num += 1;
      let examQ: ExamQuestion | null = null;
      if (row.source === "bank" && row.bankQuestionId) {
        const bank = bankById.get(row.bankQuestionId);
        if (!bank) continue;
        examQ = bankToExamQuestion(
          bank,
          sec.id,
          row.questionId,
          num,
          row.marks,
          row.negativeMarks,
        );
      } else if (row.source === "manual" && row.manual) {
        examQ = manualToExamQuestion(
          row.manual,
          sec.id,
          row.questionId,
          num,
          row.marks,
          row.negativeMarks,
        );
      }
      if (examQ) {
        questions[row.questionId] = examQ;
        examSec.questionIds.push(row.questionId);
      }
    }
  }

  const totalQuestions = Object.keys(questions).length;
  if (totalQuestions === 0) return null;

  return {
    id: test.id,
    title: test.title,
    subtitle: `Institute test · ${test.instituteId}`,
    examType: "CET",
    durationMinutes: test.durationMinutes,
    totalQuestions,
    sections,
    questions,
    instructions: ["Answer all questions within the time limit.", "Rough work is allowed."],
    scheduledAt: new Date(test.createdAt).toISOString(),
  };
}
