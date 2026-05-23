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

  const options = bank.options.map((option) => ({
    id: `${examQuestionId}-opt-${option.label}`,
    label: option.label,
    text: option.text,
  }));
  const correctOption =
    options.find(
      (option) => option.label === bank.correctAnswer || option.id === bank.correctAnswer,
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
  const options = manual.options.map((option) => ({
    id: `${examQuestionId}-opt-${option.label}`,
    label: option.label,
    text: option.text,
  }));
  const correctOption = options.find((option) => option.label === manual.correctLabel) ?? options[0];

  return {
    id: examQuestionId,
    sectionId,
    number: order,
    type: "MCQ_SINGLE",
    text: manual.text,
    options,
    correctOptionId: correctOption?.id,
    marks,
    negativeMarks,
  };
}

export function cbtTestToExamDefinition(test: CBTTest): ExamDefinition | null {
  const bankById = new Map(getQuestionBank().map((question) => [question.id, question]));
  const orderedSections = [...test.sections].sort((a, b) => a.order - b.order);
  if (orderedSections.length === 0 || test.questions.length === 0) return null;

  const questions: Record<string, ExamQuestion> = {};
  const sections: ExamSection[] = orderedSections.map((section) => ({
    id: section.id,
    name: section.name,
    questionIds: [],
  }));
  const sectionIndex = new Map(sections.map((section) => [section.id, section]));

  const questionsBySection = new Map<string, CBTTestQuestion[]>();
  for (const question of test.questions) {
    const rows = questionsBySection.get(question.sectionId) ?? [];
    rows.push(question);
    questionsBySection.set(question.sectionId, rows);
  }

  for (const section of orderedSections) {
    const examSection = sectionIndex.get(section.id);
    if (!examSection) continue;

    const rows = (questionsBySection.get(section.id) ?? []).slice();
    rows.sort((a, b) => a.questionId.localeCompare(b.questionId));

    let number = 0;
    for (const row of rows) {
      number += 1;
      let examQuestion: ExamQuestion | null = null;

      if (row.source === "bank" && row.bankQuestionId) {
        const bankQuestion = bankById.get(row.bankQuestionId);
        if (!bankQuestion) continue;
        examQuestion = bankToExamQuestion(
          bankQuestion,
          section.id,
          row.questionId,
          number,
          row.marks,
          row.negativeMarks,
        );
      } else if (row.source === "manual" && row.manual) {
        examQuestion = manualToExamQuestion(
          row.manual,
          section.id,
          row.questionId,
          number,
          row.marks,
          row.negativeMarks,
        );
      }

      if (!examQuestion) continue;
      questions[row.questionId] = examQuestion;
      examSection.questionIds.push(row.questionId);
    }
  }

  const totalQuestions = Object.keys(questions).length;
  if (totalQuestions === 0) return null;

  return {
    id: test.id,
    title: test.title,
    subtitle: `${test.sourceFileName ?? "Institute test"} | ${test.instituteId}`,
    examType: "JEE_MAIN",
    durationMinutes: test.durationMinutes,
    totalQuestions,
    sections,
    questions,
    instructions:
      test.instructions && test.instructions.length > 0
        ? test.instructions
        : ["Answer all questions within the time limit.", "Rough work is allowed."],
    scheduledAt: new Date(test.createdAt).toISOString(),
  };
}
