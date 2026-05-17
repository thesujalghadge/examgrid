import { parseExamDefinition } from "@/lib/validation/exam-schema";
import type { ExamBuildDraft } from "@/types/exam-builder";
import type { BankQuestion } from "@/types/question-bank";
import type { ExamDefinition, ExamQuestion, ExamOption } from "@/types/exam";

function slugId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function resolveMcqCorrectOptionId(
  bankQ: BankQuestion,
  options: ExamOption[],
): string | undefined {
  const ans = bankQ.correctAnswer.trim();
  const byLabel = options.find(
    (o) => o.label.toUpperCase() === ans.toUpperCase(),
  );
  if (byLabel) return byLabel.id;
  const byId = options.find((o) => o.id === ans);
  return byId?.id ?? options[0]?.id;
}

function bankToExamQuestion(
  bankQ: BankQuestion,
  examId: string,
  sectionId: string,
  number: number,
): ExamQuestion {
  const baseId = `${examId}-${sectionId}-${bankQ.id}`;
  const options: ExamOption[] = bankQ.options.map((o) => ({
    id: `${baseId}-opt-${o.label}`,
    label: o.label,
    text: o.text,
  }));

  if (bankQ.questionType === "NUMERICAL") {
    return {
      id: baseId,
      sectionId,
      number,
      type: "NUMERICAL",
      text: bankQ.questionText,
      options: [],
      correctNumericalAnswer: bankQ.correctAnswer,
      marks: bankQ.marks,
      negativeMarks: bankQ.negativeMarks,
    };
  }

  return {
    id: baseId,
    sectionId,
    number,
    type: "MCQ_SINGLE",
    text: bankQ.questionText,
    options,
    correctOptionId: resolveMcqCorrectOptionId(bankQ, options),
    marks: bankQ.marks,
    negativeMarks: bankQ.negativeMarks,
  };
}

export interface BuildExamValidationError {
  message: string;
}

export function validateExamDraft(draft: ExamBuildDraft): BuildExamValidationError[] {
  const errors: BuildExamValidationError[] = [];
  if (!draft.title.trim()) errors.push({ message: "Exam title is required" });
  if (draft.durationMinutes <= 0) {
    errors.push({ message: "Duration must be greater than 0" });
  }
  if (draft.sections.length === 0) {
    errors.push({ message: "At least one section is required" });
  }
  draft.sections.forEach((sec, i) => {
    if (!sec.name.trim()) {
      errors.push({ message: `Section ${i + 1}: name is required` });
    }
    if (sec.questionIds.length === 0) {
      errors.push({
        message: `Section "${sec.name || i + 1}": assign at least one question`,
      });
    }
  });
  return errors;
}

export function buildExamDefinition(
  draft: ExamBuildDraft,
  bank: BankQuestion[],
): { exam?: ExamDefinition; errors: BuildExamValidationError[] } {
  const validationErrors = validateExamDraft(draft);
  if (validationErrors.length > 0) {
    return { errors: validationErrors };
  }

  const bankMap = new Map(bank.map((q) => [q.id, q]));
  const examId = draft.id ?? slugId("exam");
  const questions: Record<string, ExamQuestion> = {};
  const sections = draft.sections.map((sec) => {
    const questionIds: string[] = [];
    sec.questionIds.forEach((bankId, idx) => {
      const bankQ = bankMap.get(bankId);
      if (!bankQ) return;
      const eq = bankToExamQuestion(bankQ, examId, sec.id, idx + 1);
      questions[eq.id] = eq;
      questionIds.push(eq.id);
    });
    return {
      id: sec.id,
      name: sec.name.trim(),
      questionIds,
    };
  });

  const totalQuestions = sections.reduce(
    (n, s) => n + s.questionIds.length,
    0,
  );
  if (totalQuestions === 0) {
    return {
      errors: [{ message: "No valid questions found in assigned sections" }],
    };
  }

  const exam: ExamDefinition = {
    id: examId,
    title: draft.title.trim(),
    subtitle: draft.subtitle.trim() || "Institute CBT Examination",
    examType: draft.examType,
    durationMinutes: draft.durationMinutes,
    totalQuestions,
    scheduledAt: draft.scheduledAt,
    sections,
    questions,
    instructions:
      draft.instructions.length > 0
        ? draft.instructions
        : [
            `Total duration: ${draft.durationMinutes} minutes.`,
            "This paper may contain MCQ and Numerical Value Type questions.",
            "Use the on-screen keypad for numerical answers.",
            "Do not switch tabs or exit fullscreen during the examination.",
          ],
  };

  const parsed = parseExamDefinition(exam);
  if (!parsed.success) {
    return {
      errors: [{ message: `Exam schema validation failed: ${parsed.error}` }],
    };
  }

  return { exam, errors: [] };
}
