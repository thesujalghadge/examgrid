import {
  bankQuestionInputSchema,
  questionImportPayloadSchema,
} from "@/lib/validation/question-schema";
import { withQuestionIntelligenceDefaults } from "@/lib/question-intelligence/defaults";
import type { BankQuestion } from "@/types/question-bank";
import type { QuestionType } from "@/types/exam";

export type QuestionImportFormat = "json" | "csv" | "manual";

export interface ImportValidationError {
  index: number;
  field?: string;
  message: string;
  raw?: unknown;
}

export interface ImportResult {
  success: boolean;
  questions: BankQuestion[];
  errors: ImportValidationError[];
  metadataPreview?: ImportMetadataPreview;
  diagnostics?: ImportDiagnostics;
}

export interface ImportMetadataPreview {
  totalQuestions: number;
  bySubject: Record<string, number>;
  byExamSource: Record<string, number>;
  byYear: Record<string, number>;
  bySourceType: Record<string, number>;
  taggedQuestions: number;
  solutionReadyQuestions: number;
}

export interface ImportDiagnostics {
  format: QuestionImportFormat;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  importedRows: number;
  skippedRows: number;
  duplicateFingerprintRows: number;
  partialImport: boolean;
  warnings: string[];
}

export interface ImportOptions {
  format?: QuestionImportFormat;
  allowPartial?: boolean;
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
  const difficulty = raw.difficulty ?? raw.difficultyLevel;
  if (typeof difficulty !== "string" || !DIFFICULTIES.has(difficulty)) {
    push("difficultyLevel", "difficultyLevel must be easy, medium, or hard");
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

  if (raw.solution != null && typeof raw.solution !== "string") {
    push("solution", "solution must be a string");
  }

  const zodResult = bankQuestionInputSchema.safeParse(raw);
  if (!zodResult.success) {
    zodResult.error.issues.forEach((issue) => {
      push(
        issue.path.length > 0 ? issue.path.join(".") : "question",
        issue.message,
      );
    });
  }

  return errors;
}

function parseMaybeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((v) => v.trim()).filter(Boolean);
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map(String).map((v) => v.trim()).filter(Boolean);
      }
    } catch {
      return [];
    }
  }
  return trimmed.split(/[|;]/).map((v) => v.trim()).filter(Boolean);
}

function parseMaybeNumber(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeRawQuestion(raw: Record<string, unknown>): Record<string, unknown> {
  const optionsFromColumns = ["A", "B", "C", "D", "E"].flatMap((label) => {
    const text = raw[`option${label}`] ?? raw[`option_${label}`] ?? raw[label];
    return typeof text === "string" && text.trim()
      ? [{ label, text: text.trim() }]
      : [];
  });
  const options =
    Array.isArray(raw.options) || typeof raw.options === "string"
      ? raw.options
      : optionsFromColumns;

  return {
    ...raw,
    examYear: parseMaybeNumber(raw.examYear),
    marks: parseMaybeNumber(raw.marks),
    negativeMarks: parseMaybeNumber(raw.negativeMarks),
    estimatedSolveTimeSeconds: parseMaybeNumber(raw.estimatedSolveTimeSeconds),
    weightageScore: parseMaybeNumber(raw.weightageScore),
    predictiveScore: parseMaybeNumber(raw.predictiveScore),
    formulaTags: parseMaybeArray(raw.formulaTags),
    conceptTags: parseMaybeArray(raw.conceptTags),
    mistakeTags: parseMaybeArray(raw.mistakeTags),
    relatedQuestionIds: parseMaybeArray(raw.relatedQuestionIds),
    options,
  };
}

function toBankQuestion(
  raw: Record<string, unknown>,
  index: number,
): BankQuestion {
  const now = Date.now();
  const parsed = bankQuestionInputSchema.parse(raw);
  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id.trim()
      : `bank-${now}-${index}`;
  const qType = parsed.questionType as QuestionType;

  return {
    ...withQuestionIntelligenceDefaults({
      ...parsed,
      id,
      createdAt: now,
      updatedAt: now,
    }),
    id,
    subject: parsed.subject.trim(),
    examSource: parsed.examSource.trim(),
    chapter: parsed.chapter.trim(),
    topic: parsed.topic.trim(),
    subtopic: parsed.subtopic.trim(),
    questionText: parsed.questionText.trim(),
    options:
      qType === "NUMERICAL"
        ? []
        : parsed.options.map((o) => ({
            label: o.label.trim(),
            text: o.text.trim(),
          })),
    correctAnswer: parsed.correctAnswer.trim(),
    createdAt: now,
    updatedAt: now,
  };
}

function increment(map: Record<string, number>, key: string | number | undefined): void {
  const resolved = key == null || key === "" ? "Unspecified" : String(key);
  map[resolved] = (map[resolved] ?? 0) + 1;
}

function createMetadataPreview(questions: BankQuestion[]): ImportMetadataPreview {
  const preview: ImportMetadataPreview = {
    totalQuestions: questions.length,
    bySubject: {},
    byExamSource: {},
    byYear: {},
    bySourceType: {},
    taggedQuestions: 0,
    solutionReadyQuestions: 0,
  };

  questions.forEach((question) => {
    increment(preview.bySubject, question.subject);
    increment(preview.byExamSource, question.examSource);
    increment(preview.byYear, question.examYear);
    increment(preview.bySourceType, question.sourceType);
    if (
      question.chapter ||
      question.topic ||
      question.subtopic ||
      question.conceptTags.length > 0 ||
      question.formulaTags.length > 0
    ) {
      preview.taggedQuestions++;
    }
    if (question.solutionDetailed || question.solutionShort || question.solution) {
      preview.solutionReadyQuestions++;
    }
  });

  return preview;
}

function createDiagnostics(
  format: QuestionImportFormat,
  totalRows: number,
  questions: BankQuestion[],
  errors: ImportValidationError[],
  allowPartial: boolean,
): ImportDiagnostics {
  const fingerprints = new Map<string, number>();
  questions.forEach((question) => {
    fingerprints.set(
      question.similarityFingerprint,
      (fingerprints.get(question.similarityFingerprint) ?? 0) + 1,
    );
  });
  return {
    format,
    totalRows,
    validRows: questions.length,
    invalidRows: new Set(errors.map((error) => error.index)).size,
    importedRows: questions.length,
    skippedRows: Math.max(0, totalRows - questions.length),
    duplicateFingerprintRows: [...fingerprints.values()].filter((count) => count > 1).length,
    partialImport: allowPartial && errors.length > 0 && questions.length > 0,
    warnings:
      errors.length > 0 && allowPartial
        ? ["Some rows were skipped because partial import is enabled."]
        : [],
  };
}

function parseJsonQuestionList(json: unknown): unknown[] | { error: string } {
  if (!isRecord(json) && !Array.isArray(json)) {
    return {
      error: "Root must be a JSON object or question array",
    };
  }

  const zodShape = questionImportPayloadSchema.safeParse(json);
  if (
    !zodShape.success &&
    !Array.isArray(json) &&
    isRecord(json) &&
    !Array.isArray(json.questions)
  ) {
    return {
      error: zodShape.error.issues.map((i) => i.message).join("; "),
    };
  }

  const list = Array.isArray(json) ? json : json.questions;
  if (!Array.isArray(list)) {
    return {
      error: 'Expected { "questions": [...] } or a questions array',
    };
  }
  return list;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i++;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
  });
}

function validateAndBuildQuestions(
  rows: unknown[],
  options: Required<ImportOptions>,
): ImportResult {
  const allErrors: ImportValidationError[] = [];
  const questions: BankQuestion[] = [];

  rows.forEach((item, index) => {
    const normalized = isRecord(item) ? normalizeRawQuestion(item) : item;
    const rowErrors = validateRawQuestion(normalized, index);
    if (rowErrors.length > 0) {
      allErrors.push(...rowErrors.map((error) => ({ ...error, raw: item })));
      return;
    }
    questions.push(toBankQuestion(normalized as Record<string, unknown>, index));
  });

  if (allErrors.length > 0 && !options.allowPartial) {
    return {
      success: false,
      questions: [],
      errors: allErrors,
      diagnostics: createDiagnostics(options.format, rows.length, [], allErrors, false),
    };
  }

  return {
    success: questions.length > 0,
    questions,
    errors: allErrors,
    metadataPreview: createMetadataPreview(questions),
    diagnostics: createDiagnostics(
      options.format,
      rows.length,
      questions,
      allErrors,
      options.allowPartial,
    ),
  };
}

export function parseAndValidateQuestionImport(
  json: unknown,
  options: ImportOptions = {},
): ImportResult {
  const resolvedOptions: Required<ImportOptions> = {
    format: options.format ?? "json",
    allowPartial: options.allowPartial ?? false,
  };
  const list = parseJsonQuestionList(json);
  if (!Array.isArray(list)) {
    return {
      success: false,
      questions: [],
      errors: [{ index: -1, message: list.error }],
      diagnostics: createDiagnostics(resolvedOptions.format, 0, [], [], false),
    };
  }

  return validateAndBuildQuestions(list, resolvedOptions);
}

export function parseAndValidateQuestionCsv(
  csvText: string,
  options: ImportOptions = {},
): ImportResult {
  const rows = parseCsv(csvText);
  return validateAndBuildQuestions(rows, {
    format: options.format ?? "csv",
    allowPartial: options.allowPartial ?? true,
  });
}

export function parseAndValidateManualQuestion(
  raw: Record<string, unknown>,
): ImportResult {
  return validateAndBuildQuestions([raw], {
    format: "manual",
    allowPartial: false,
  });
}

export function parseQuestionImportText(
  text: string,
  options: ImportOptions = {},
): ImportResult {
  const format =
    options.format ??
    (text.trimStart().startsWith("{") || text.trimStart().startsWith("[")
      ? "json"
      : "csv");
  if (format === "csv") return parseAndValidateQuestionCsv(text, options);
  const parsed: unknown = JSON.parse(text);
  return parseAndValidateQuestionImport(parsed, { ...options, format });
}

export function importQuestionsFromJson(
  json: unknown,
  existing: BankQuestion[],
  options: ImportOptions = {},
): ImportResult & { merged: BankQuestion[] } {
  const result = parseAndValidateQuestionImport(json, options);
  if (!result.success) return { ...result, merged: existing };

  const byId = new Map(existing.map((q) => [q.id, q]));
  for (const q of result.questions) {
    byId.set(q.id, q);
  }
  return { ...result, merged: Array.from(byId.values()) };
}

export function importQuestionsFromText(
  text: string,
  existing: BankQuestion[],
  options: ImportOptions = {},
): ImportResult & { merged: BankQuestion[] } {
  const result = parseQuestionImportText(text, options);
  if (!result.success) return { ...result, merged: existing };

  const byId = new Map(existing.map((q) => [q.id, q]));
  for (const q of result.questions) {
    byId.set(q.id, q);
  }
  return { ...result, merged: Array.from(byId.values()) };
}
