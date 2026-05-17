import { questionImportPayloadSchema } from "@/lib/validation/question-schema";
import type { BankQuestion, QuestionImportPayload } from "@/types/question-bank";
import type { QuestionType } from "@/types/exam";

export interface ImportValidationError {
  index: number;
  field?: string;
  message: string;
}

export interface ImportResult {
  success: boolean;
  questions: BankQuestion[];
  errors: ImportValidationError[];
}

const DIFFICULTIES = new Set(["easy", "medium", "hard"]);
const TYPES = new Set<QuestionType>(["MCQ_SINGLE", "NUMERICAL"]);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateOption(opt: unknown, qIndex: number, oIndex: number): string | null {
  if (!isRecord(opt)) return `Question ${qIndex + 1}, option ${oIndex + 1}: must be an object`;
  if (typeof opt.label !== "string" || !opt.label.trim()) {
    return `Question ${qIndex + 1}, option ${oIndex + 1}: label required`;
  }
  if (typeof opt.text !== "string" || !opt.text.trim()) {
    return `Question ${qIndex + 1}, option ${oIndex + 1}: text required`;
  }
  return null;
}

function validateRawQuestion(raw: unknown, index: number): ImportValidationError[] {
  const errors: ImportValidationError[] = [];
  if (!isRecord(raw)) {
    return [{ index, message: "Question must be an object" }];
  }

  const push = (field: string, message: string) =>
    errors.push({ index, field, message });

  if (typeof raw.subject !== "string" || !raw.subject.trim()) {
    push("subject", "subject is required");
  }
  if (typeof raw.chapter !== "string" || !raw.chapter.trim()) {
    push("chapter", "chapter is required");
  }
  if (typeof raw.topic !== "string" || !raw.topic.trim()) {
    push("topic", "topic is required");
  }
  if (
    typeof raw.difficulty !== "string" ||
    !DIFFICULTIES.has(raw.difficulty)
  ) {
    push("difficulty", "difficulty must be easy, medium, or hard");
  }
  if (typeof raw.questionType !== "string" || !TYPES.has(raw.questionType as QuestionType)) {
    push("questionType", "questionType must be MCQ_SINGLE or NUMERICAL");
  }
  if (typeof raw.questionText !== "string" || !raw.questionText.trim()) {
    push("questionText", "questionText is required");
  }
  if (typeof raw.correctAnswer !== "string" || !raw.correctAnswer.trim()) {
    push("correctAnswer", "correctAnswer is required");
  }
  if (typeof raw.marks !== "number" || raw.marks < 0) {
    push("marks", "marks must be a non-negative number");
  }
  if (typeof raw.negativeMarks !== "number" || raw.negativeMarks < 0) {
    push("negativeMarks", "negativeMarks must be a non-negative number");
  }

  const qType = raw.questionType as QuestionType;
  const options = raw.options;

  if (qType === "MCQ_SINGLE") {
    if (!Array.isArray(options) || options.length < 2) {
      push("options", "MCQ must have at least 2 options");
    } else {
      options.forEach((opt, oi) => {
        const err = validateOption(opt, index, oi);
        if (err) push("options", err);
      });
    }
  } else if (Array.isArray(options) && options.length > 0) {
    options.forEach((opt, oi) => {
      const err = validateOption(opt, index, oi);
      if (err) push("options", err);
    });
  }

  if (typeof raw.solution !== "string") {
    push("solution", "solution must be a string (can be empty)");
  }

  return errors;
}

function toBankQuestion(
  raw: Record<string, unknown>,
  index: number,
): BankQuestion {
  const now = Date.now();
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `bank-${now}-${index}`;
  const qType = raw.questionType as QuestionType;
  const options = Array.isArray(raw.options)
    ? raw.options.map((o) => {
        const opt = o as Record<string, unknown>;
        return {
          label: String(opt.label).trim(),
          text: String(opt.text).trim(),
        };
      })
    : [];

  return {
    id,
    subject: String(raw.subject).trim(),
    chapter: String(raw.chapter).trim(),
    topic: String(raw.topic).trim(),
    difficulty: raw.difficulty as BankQuestion["difficulty"],
    questionType: qType,
    questionText: String(raw.questionText).trim(),
    options: qType === "NUMERICAL" ? [] : options,
    correctAnswer: String(raw.correctAnswer).trim(),
    solution: typeof raw.solution === "string" ? raw.solution : "",
    marks: Number(raw.marks),
    negativeMarks: Number(raw.negativeMarks),
    createdAt: now,
    updatedAt: now,
  };
}

export function parseAndValidateQuestionImport(json: unknown): ImportResult {
  if (!isRecord(json)) {
    return {
      success: false,
      questions: [],
      errors: [{ index: -1, message: "Root must be a JSON object" }],
    };
  }

  const zodShape = questionImportPayloadSchema.safeParse(json);
  if (!zodShape.success && !Array.isArray(json.questions) && !Array.isArray(json)) {
    return {
      success: false,
      questions: [],
      errors: [
        {
          index: -1,
          message: zodShape.error.issues.map((i) => i.message).join("; "),
        },
      ],
    };
  }

  const list = json.questions ?? json;
  if (!Array.isArray(list)) {
    return {
      success: false,
      questions: [],
      errors: [
        {
          index: -1,
          message: 'Expected { "questions": [...] } or a questions array',
        },
      ],
    };
  }

  const allErrors: ImportValidationError[] = [];
  list.forEach((item, index) => {
    allErrors.push(...validateRawQuestion(item, index));
  });

  if (allErrors.length > 0) {
    return { success: false, questions: [], errors: allErrors };
  }

  const questions = list.map((item, index) =>
    toBankQuestion(item as Record<string, unknown>, index),
  );

  return { success: true, questions, errors: [] };
}

export function importQuestionsFromJson(
  json: unknown,
  existing: BankQuestion[],
): ImportResult & { merged: BankQuestion[] } {
  const result = parseAndValidateQuestionImport(json);
  if (!result.success) return { ...result, merged: existing };

  const byId = new Map(existing.map((q) => [q.id, q]));
  for (const q of result.questions) {
    byId.set(q.id, q);
  }
  return { ...result, merged: Array.from(byId.values()) };
}
