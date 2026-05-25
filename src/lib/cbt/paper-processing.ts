import {
  logParsingEvent,
  logParsingWarning,
  logUploadEvent,
  logValidationFailure,
} from "@/lib/logging/runtime-logger";
import type {
  AnswerKeyReviewItem,
  PaperExtractionSummary,
  PaperProcessingStage,
  PreparedQuestionMeta,
  ProcessedPaperPackage,
  ProcessedPaperValidationIssue,
  SupportedPaperFileType,
  UploadExtractionMode,
} from "@/types/cbt-paper-processing";
import type { BankQuestion } from "@/types/question-bank";

const STAGE_LABELS: Record<PaperProcessingStage, string> = {
  extracting_questions: "Extracting readable text from uploaded paper...",
  mapping_sections: "Segmenting questions and sections...",
  detecting_subjects: "Detecting subject ownership and question types...",
  mapping_answers: "Mapping answer key and validating answer coverage...",
  building_preview: "Preparing editable CBT preview...",
  preparing_analytics_metadata: "Finalizing normalized question metadata...",
};

export const MAX_PAPER_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAX_ANSWER_KEY_UPLOAD_BYTES = 2 * 1024 * 1024;
export const SCANNED_DOCUMENT_WARNING =
  "We detected a scanned or complex document. Please review extracted content before publishing.";
const DEFAULT_DURATION_MINUTES = 60;
const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"] as const;
const SUBJECT_KEYWORDS: Array<{ subject: string; keywords: string[] }> = [
  { subject: "Physics", keywords: ["velocity", "force", "current", "acceleration", "newton"] },
  { subject: "Chemistry", keywords: ["mole", "reaction", "equilibrium", "acid", "atom"] },
  { subject: "Mathematics", keywords: ["integral", "derivative", "quadratic", "matrix", "triangle"] },
  { subject: "Biology", keywords: ["cell", "organism", "enzyme", "genetics"] },
];

type SupportedFileType = SupportedPaperFileType;

interface QuestionBlock {
  questionNumber: number;
  section: string;
  lines: string[];
}

interface ParsedOption {
  label: string;
  text: string;
}

interface ParsedAnswerEntry {
  questionNumber: number;
  answer: string;
  raw: string;
}

interface ParsePaperInput {
  instituteId: string;
  paperFileName: string;
  paperFileType: SupportedPaperFileType;
  paperText: string;
  answerKeyFileName?: string;
  answerKeyFileType?: SupportedPaperFileType;
  answerKeyText?: string;
  extractionMode: UploadExtractionMode;
  extractionSummary: Omit<PaperExtractionSummary, "questionsDetected">;
  onStage?: (stage: PaperProcessingStage, log: string[]) => void;
}

function mapDifficulty(
  difficulty: "L1" | "L2" | "L3" | undefined,
): "easy" | "medium" | "hard" {
  if (difficulty === "L1") return "easy";
  if (difficulty === "L3") return "hard";
  return "medium";
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .trim();
}

function sanitizeLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function makeLog(log: string[], message: string): string[] {
  const entry = `${new Date().toISOString()} ${message}`;
  log.push(entry);
  return [...log];
}

function looksLikeQuestionStart(line: string): RegExpMatchArray | null {
  return (
    line.match(/^\(?(\d{1,3})\)\s*(.*)$/i) ??
    line.match(/^(\d{1,3})\.\s*(.*)$/i) ??
    line.match(/^(\d{1,3})\)\s*(.*)$/i) ??
    line.match(/^q(?:uestion)?\s*(\d{1,3})[:.)\-\s]*\s*(.*)$/i) ??
    line.match(/^que\.?\s*(\d{1,3})[:.)\-\s]*\s*(.*)$/i)
  );
}

function looksLikeSectionHeader(line: string): string | null {
  const named = line.match(/^section\s+[a-z0-9]+\s*[:.-]\s*(.+)$/i);
  if (named?.[1]) return sanitizeLine(named[1]);
  const subject = SUBJECTS.find((item) => item.toLowerCase() === line.toLowerCase());
  return subject ?? null;
}

function parseQuestionBlocks(text: string): QuestionBlock[] {
  const lines = normalizeText(text)
    .split("\n")
    .map((line) => sanitizeLine(line))
    .filter(Boolean);
  const blocks: QuestionBlock[] = [];
  let currentSection = "Imported Questions";
  let active: QuestionBlock | null = null;

  for (const line of lines) {
    const section = looksLikeSectionHeader(line);
    if (section) {
      currentSection = section;
      continue;
    }

    const start = looksLikeQuestionStart(line);
    if (start) {
      if (active) blocks.push(active);
      active = {
        questionNumber: Number(start[1]),
        section: currentSection,
        lines: [sanitizeLine(start[2])],
      };
      continue;
    }

    if (active) active.lines.push(line);
  }

  if (active) blocks.push(active);
  return blocks;
}

function parseInlineOptions(text: string): ParsedOption[] {
  const matches = [
    ...text.matchAll(/(?:^|\s)([A-D])[\).:-]\s*(.+?)(?=(?:\s+[A-D][\).:-]\s+)|$)/g),
    ...text.matchAll(/(?:^|\s)\(([A-D])\)\s*(.+?)(?=(?:\s+\([A-D]\)\s+)|$)/g),
  ];
  return matches.map((match) => ({
    label: match[1].toUpperCase(),
    text: sanitizeLine(match[2]),
  }));
}

function parseOptions(lines: string[]): { options: ParsedOption[]; remaining: string[] } {
  const options: ParsedOption[] = [];
  const remaining: string[] = [];
  let activeOption: ParsedOption | null = null;

  const flushActiveOption = () => {
    if (!activeOption) return;
    options.push({
      label: activeOption.label,
      text: sanitizeLine(activeOption.text),
    });
    activeOption = null;
  };

  for (const line of lines) {
    const direct =
      line.match(/^[\(\[]?([A-D])[\)\].:-]\s*(.+)$/i) ??
      line.match(/^option\s+([A-D])[:.)\-\s]+\s*(.+)$/i);
    if (direct) {
      flushActiveOption();
      activeOption = {
        label: direct[1].toUpperCase(),
        text: sanitizeLine(direct[2]),
      };
      continue;
    }

    const inline = parseInlineOptions(line);
    if (inline.length >= 2) {
      flushActiveOption();
      options.push(...inline);
      continue;
    }

    if (activeOption && line.length > 0 && !looksLikeQuestionStart(line)) {
      activeOption = {
        ...activeOption,
        text: `${activeOption.text} ${sanitizeLine(line)}`,
      };
      continue;
    }

    remaining.push(line);
  }

  flushActiveOption();

  return {
    options: dedupeOptions(options),
    remaining,
  };
}

function dedupeOptions(options: ParsedOption[]): ParsedOption[] {
  const byLabel = new Map<string, ParsedOption>();
  for (const option of options) {
    byLabel.set(option.label, option);
  }
  return ["A", "B", "C", "D"]
    .map((label) => byLabel.get(label))
    .filter((option): option is ParsedOption => Boolean(option));
}

function detectSubject(section: string, text: string): string {
  const exact = SUBJECTS.find((subject) => section.toLowerCase().includes(subject.toLowerCase()));
  if (exact) return exact;
  const lowered = text.toLowerCase();
  for (const { subject, keywords } of SUBJECT_KEYWORDS) {
    if (keywords.some((keyword) => lowered.includes(keyword))) return subject;
  }
  return section;
}

function parseAnswerKeyEntries(text?: string): ParsedAnswerEntry[] {
  if (!text) return [];
  const normalized = normalizeText(text);
  const entries: ParsedAnswerEntry[] = [];
  const patterns = [
    /(?:^|\n)\s*(?:q(?:uestion)?|que\.?)?\s*(\d{1,3})\s*(?:->|[-.:])\s*([A-D]|-?\d+(?:\.\d+)?)/gi,
    /(?:^|\n)\s*(\d{1,3})\s+([A-D]|-?\d+(?:\.\d+)?)/gi,
  ];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      entries.push({
        questionNumber: Number(match[1]),
        answer: match[2].toUpperCase(),
        raw: sanitizeLine(match[0]),
      });
    }
  }
  return entries;
}

function mapAnswerEntries(
  entries: ParsedAnswerEntry[],
  blocks: QuestionBlock[],
): {
  mappedAnswers: Map<number, string>;
  unmatchedAnswers: AnswerKeyReviewItem[];
  duplicateAnswers: AnswerKeyReviewItem[];
} {
  const mappedAnswers = new Map<number, string>();
  const unmatchedAnswers: AnswerKeyReviewItem[] = [];
  const duplicateAnswers: AnswerKeyReviewItem[] = [];
  const questionNumbers = new Set(blocks.map((block) => block.questionNumber));

  for (const entry of entries) {
    if (!questionNumbers.has(entry.questionNumber)) {
      unmatchedAnswers.push({
        questionNumber: entry.questionNumber,
        answer: entry.answer,
        reason: "unmatched",
      });
      continue;
    }
    if (mappedAnswers.has(entry.questionNumber)) {
      duplicateAnswers.push({
        questionNumber: entry.questionNumber,
        answer: entry.answer,
        reason: "duplicate",
      });
      continue;
    }
    mappedAnswers.set(entry.questionNumber, entry.answer);
  }

  return { mappedAnswers, unmatchedAnswers, duplicateAnswers };
}

function parseInlineAnswer(lines: string[]): string {
  for (const line of lines) {
    const answer =
      line.match(/^(?:answer|ans)\s*[:.-]\s*([A-D]|-?\d+(?:\.\d+)?)$/i) ??
      line.match(/\((?:answer|ans)\s*[:.-]\s*([A-D]|-?\d+(?:\.\d+)?)\)$/i);
    if (answer?.[1]) return answer[1].toUpperCase();
  }
  return "";
}

function isNumericAnswer(answer: string): boolean {
  return /^-?\d+(?:\.\d+)?$/.test(answer.trim());
}

function computeConfidence(input: {
  questionText: string;
  optionCount: number;
  correctAnswer: string;
  extractionMode: UploadExtractionMode;
  usedOCR: boolean;
}): number {
  let confidence = 0.25;
  if (input.questionText.length > 20) confidence += 0.25;
  if (input.optionCount >= 4) confidence += 0.25;
  if (input.correctAnswer.trim()) confidence += 0.15;
  if (input.extractionMode === "file") confidence += 0.05;
  if (input.extractionMode === "hybrid") confidence += 0.02;
  if (input.usedOCR) confidence -= 0.12;
  return Number(Math.max(0.1, Math.min(0.99, confidence)).toFixed(2));
}

function buildQuestionMeta(
  pkgId: string,
  block: QuestionBlock,
  answerKey: Map<number, string>,
  extractionMode: UploadExtractionMode,
  usedOCR: boolean,
): PreparedQuestionMeta {
  const { options, remaining } = parseOptions(block.lines);
  const linesWithoutAnswers = remaining.filter((line) => !/^(?:answer|ans)\s*[:.-]/i.test(line));
  const questionText = sanitizeLine(linesWithoutAnswers.join(" "));
  const inlineAnswer = parseInlineAnswer(block.lines);
  const correctAnswer = answerKey.get(block.questionNumber) ?? inlineAnswer;
  const subject = detectSubject(block.section, questionText);
  const hasValidOptions = options.some((option) => option.text.trim());
  const questionType =
    hasValidOptions || !isNumericAnswer(correctAnswer) ? "MCQ_SINGLE" : "NUMERICAL";
  const confidence = computeConfidence({
    questionText,
    optionCount: options.length,
    correctAnswer,
    extractionMode,
    usedOCR,
  });

  return {
    questionId: `${pkgId}-q-${block.questionNumber}`,
    sequence: block.questionNumber,
    subject,
    section: block.section,
    chapter: undefined,
    topic: undefined,
    difficulty: undefined,
    confidence,
    questionType,
    questionText,
    correctAnswer,
    solution: undefined,
    marks: 4,
    negativeMarks: 1,
    optionLabels: options.map((option) => option.text),
    images: [],
    explanation: undefined,
    metadata: {
      parser: "deterministic_v2",
      sourceQuestionNumber: block.questionNumber,
      answerKeySource: answerKey.has(block.questionNumber)
        ? "answer_key_file"
        : inlineAnswer
          ? "inline_paper"
          : "missing",
      detectedQuestionType: questionType,
    },
  };
}

function buildSections(questions: PreparedQuestionMeta[]) {
  const sectionMap = new Map<string, PreparedQuestionMeta[]>();
  for (const question of questions) {
    const list = sectionMap.get(question.section) ?? [];
    list.push(question);
    sectionMap.set(question.section, list);
  }

  if (sectionMap.size === 0) {
    return [{ id: "section-imported-questions", name: "Imported Questions", questions: [] }];
  }

  return [...sectionMap.entries()].map(([name, rows]) => ({
    id: `section-${slug(name) || "imported-questions"}`,
    name,
    questions: rows.sort((a, b) => a.sequence - b.sequence),
  }));
}

function buildRawTextPreview(text: string): string {
  return normalizeText(text).slice(0, 4000);
}

export function getProcessingStageLabels(): PaperProcessingStage[] {
  return Object.keys(STAGE_LABELS) as PaperProcessingStage[];
}

export function getStageLabel(stage: PaperProcessingStage): string {
  return STAGE_LABELS[stage];
}

export function detectFileType(name: string, allowed: readonly SupportedFileType[]): SupportedFileType {
  const lower = name.toLowerCase();
  const type = lower.endsWith(".docx")
    ? "docx"
    : lower.endsWith(".doc")
      ? "doc"
      : lower.endsWith(".xlsx")
        ? "xlsx"
        : lower.endsWith(".csv")
          ? "csv"
          : lower.endsWith(".txt")
            ? "txt"
            : "pdf";
  if (!allowed.includes(type)) {
    throw new Error(`Unsupported file type for ${name}.`);
  }
  return type;
}

export function validateUploadFile(input: {
  name: string;
  size: number;
  allowedTypes: readonly SupportedFileType[];
  maxBytes: number;
}): void {
  detectFileType(input.name, input.allowedTypes);
  if (input.size <= 0) {
    throw new Error(`Uploaded file ${input.name} is empty.`);
  }
  if (input.size > input.maxBytes) {
    throw new Error(
      `${input.name} exceeds the ${Math.round(input.maxBytes / (1024 * 1024))} MB upload limit.`,
    );
  }
}

export function isLikelyReadableText(text: string): boolean {
  const normalized = normalizeText(text);
  if (normalized.length < 40) return false;
  const printable = normalized.replace(/[\sA-Za-z0-9,.;:(){}\[\]<>!?'"%+\-/*=&]/g, "");
  return printable.length / normalized.length < 0.15;
}

export function createBlankPreparedQuestion(sequence: number, section = "Imported Questions"): PreparedQuestionMeta {
  return {
    questionId: `manual-q-${Date.now()}-${sequence}`,
    sequence,
    subject: section,
    section,
    chapter: undefined,
    topic: undefined,
    difficulty: undefined,
    confidence: 0.2,
    questionType: "MCQ_SINGLE",
    questionText: "",
    correctAnswer: "",
    solution: undefined,
    marks: 4,
    negativeMarks: 1,
    optionLabels: ["", "", "", ""],
    images: [],
    explanation: undefined,
    metadata: {
      parser: "manual_draft",
      sourceQuestionNumber: sequence,
      answerKeySource: "manual",
    },
  };
}

export function validateProcessedPaper(pkg: ProcessedPaperPackage): ProcessedPaperValidationIssue[] {
  const issues: ProcessedPaperValidationIssue[] = [];
  const seenQuestionIds = new Set<string>();
  if (!pkg.title.trim()) {
    issues.push({ level: "error", message: "Test title is required." });
  }
  if (pkg.sections.length === 0) {
    issues.push({ level: "error", message: "No sections were created from the uploaded paper." });
  }
  if (pkg.totalQuestions === 0) {
    issues.push({
      level: "warning",
      message: SCANNED_DOCUMENT_WARNING,
    });
  }
  for (const warning of pkg.extractionSummary.warnings) {
    issues.push({ level: "warning", message: warning });
  }
  for (const duplicate of pkg.parsingDiagnostics.duplicateAnswers) {
    issues.push({
      level: "warning",
      message: `Duplicate answer mapping detected for Q${duplicate.questionNumber}.`,
    });
  }
  for (const unmatched of pkg.parsingDiagnostics.unmatchedAnswers) {
    issues.push({
      level: "warning",
      message: `Answer key entry for Q${unmatched.questionNumber} did not match any parsed question.`,
    });
  }

  for (const section of pkg.sections) {
    if (!section.name.trim()) {
      issues.push({ level: "error", section: section.name, message: "Section name is required." });
    }
    for (const question of section.questions) {
      if (!question.questionId.trim()) {
        issues.push({
          level: "error",
          section: section.name,
          message: `Question ${question.sequence} is missing a stable question id.`,
        });
      } else if (seenQuestionIds.has(question.questionId)) {
        issues.push({
          level: "error",
          questionId: question.questionId,
          section: section.name,
          message: `Question ${question.sequence} has a duplicate question id.`,
        });
      } else {
        seenQuestionIds.add(question.questionId);
      }
      if (!question.questionText.trim()) {
        issues.push({
          level: "error",
          questionId: question.questionId,
          section: section.name,
          message: `Question ${question.sequence} is missing question text.`,
        });
      }
      if (question.questionType === "MCQ_SINGLE") {
        const requiredOptionLabels = ["A", "B", "C", "D"];
        for (const [optionIndex, label] of requiredOptionLabels.entries()) {
          if (!question.optionLabels[optionIndex]?.trim()) {
            issues.push({
              level: "error",
              questionId: question.questionId,
              section: section.name,
              message: `Question ${question.sequence} has an empty option ${label}.`,
            });
          }
        }
        if (question.optionLabels.filter((option) => option.trim()).length < requiredOptionLabels.length) {
          issues.push({
            level: "error",
            questionId: question.questionId,
            section: section.name,
            message: `Question ${question.sequence} needs four complete options.`,
          });
        }
        const answerIndex = requiredOptionLabels.indexOf(question.correctAnswer.toUpperCase());
        if (answerIndex < 0 || !question.optionLabels[answerIndex]?.trim()) {
          issues.push({
            level: "error",
            questionId: question.questionId,
            section: section.name,
            message: `Question ${question.sequence} is missing a valid answer key.`,
          });
        }
      } else if (!question.correctAnswer.trim()) {
        issues.push({
          level: "error",
          questionId: question.questionId,
          section: section.name,
          message: `Question ${question.sequence} is missing a numerical answer.`,
        });
      }
      if (!question.subject.trim() || question.subject === "Imported Questions") {
        issues.push({
          level: "warning",
          questionId: question.questionId,
          section: section.name,
          message: `Question ${question.sequence} needs subject review.`,
        });
      }
      if (question.confidence < 0.45) {
        issues.push({
          level: "warning",
          questionId: question.questionId,
          section: section.name,
          message: `Question ${question.sequence} has low parser confidence and should be reviewed.`,
        });
      }
    }
  }
  return dedupeIssues(issues);
}

function dedupeIssues(issues: ProcessedPaperValidationIssue[]): ProcessedPaperValidationIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.level}:${issue.section ?? ""}:${issue.questionId ?? ""}:${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeProcessedPaper(pkg: ProcessedPaperPackage): ProcessedPaperPackage {
  const sections = pkg.sections
    .map((section, sectionIndex) => ({
      ...section,
      id: `section-${slug(section.name || String(sectionIndex + 1)) || sectionIndex + 1}`,
      questions: section.questions.map((question, questionIndex) => ({
        ...question,
        sequence: questionIndex + 1,
        section: section.name,
        questionText: sanitizeLine(question.questionText),
        optionLabels: question.optionLabels.map((option) => sanitizeLine(option)),
      })),
    }))
    .filter((section) => section.questions.length > 0 || sectionIndexIsFirst(section, pkg.sections));
  const totalQuestions = sections.reduce((count, section) => count + section.questions.length, 0);
  const totalMarks = sections.reduce(
    (count, section) =>
      count + section.questions.reduce((sum, question) => sum + Math.max(0, question.marks), 0),
    0,
  );
  const normalized = {
    ...pkg,
    status: "DRAFT_REVIEW" as const,
    sections,
    totalQuestions,
    totalMarks,
    extractionSummary: {
      ...pkg.extractionSummary,
      questionsDetected: totalQuestions,
    },
  };
  return {
    ...normalized,
    validationIssues: validateProcessedPaper(normalized),
  };
}

function sectionIndexIsFirst(
  section: ProcessedPaperPackage["sections"][number],
  all: ProcessedPaperPackage["sections"],
): boolean {
  return all[0]?.id === section.id;
}

export async function runPaperProcessing(input: ParsePaperInput): Promise<ProcessedPaperPackage> {
  const log: string[] = [];
  const id = `paper-${Date.now()}`;
  const title =
    input.paperFileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() ||
    "Institute CBT Paper";

  logUploadEvent("paper_processing_started", {
    instituteId: input.instituteId,
    paperFileName: input.paperFileName,
    paperFileType: input.paperFileType,
    extractionMode: input.extractionMode,
  });

  for (const stage of getProcessingStageLabels()) {
    input.onStage?.(stage, makeLog(log, getStageLabel(stage)));
    await Promise.resolve();
  }

  const questionBlocks = parseQuestionBlocks(input.paperText);
  const answerEntries = parseAnswerKeyEntries(input.answerKeyText);
  const { mappedAnswers: answerKey, unmatchedAnswers, duplicateAnswers } = mapAnswerEntries(
    answerEntries,
    questionBlocks,
  );
  const questions = questionBlocks.map((block) =>
    buildQuestionMeta(
      id,
      block,
      answerKey,
      input.extractionMode,
      input.extractionSummary.usedOCR,
    ),
  );
  const sections = buildSections(questions);

  const initialPackage: ProcessedPaperPackage = {
    id,
    status: "DRAFT_REVIEW",
    title,
    instituteId: input.instituteId,
    paperFileName: input.paperFileName,
    paperFileType: input.paperFileType,
    answerKeyFileName: input.answerKeyFileName,
    answerKeyFileType: input.answerKeyFileType,
    durationMinutes: DEFAULT_DURATION_MINUTES,
    instructions: [
      "Read each question carefully before answering.",
      "Use the palette to review marked and unanswered questions.",
      "Submit before the timer ends.",
    ],
    sections,
    processingLog: log,
    validationIssues: [],
    extractionMode: input.extractionMode,
    extractionSummary: {
      ...input.extractionSummary,
      questionsDetected: questions.length,
    },
    parsingDiagnostics: {
      rawTextPreview: buildRawTextPreview(input.paperText),
      parsedQuestionCount: questions.length,
      unmatchedAnswerCount: unmatchedAnswers.length,
      unmatchedAnswers,
      duplicateAnswers,
    },
    preparedAt: Date.now(),
    totalMarks: 0,
    totalQuestions: 0,
  };

  makeLog(
    initialPackage.processingLog,
    JSON.stringify({
      pages: initialPackage.extractionSummary.pages,
      extractedChars: initialPackage.extractionSummary.extractedChars,
      usedOCR: initialPackage.extractionSummary.usedOCR,
      questionsDetected: questions.length,
      warnings: initialPackage.extractionSummary.warnings,
    }),
  );

  if (questionBlocks.length === 0) {
    logParsingWarning("paper_parse_no_questions", {
      instituteId: input.instituteId,
      paperFileName: input.paperFileName,
      pages: input.extractionSummary.pages,
      extractedChars: input.extractionSummary.extractedChars,
      usedOCR: input.extractionSummary.usedOCR,
    });
    makeLog(
      initialPackage.processingLog,
      "No numbered questions were detected automatically. Review the extracted content and add questions manually in the draft preview.",
    );
  }

  const normalized = normalizeProcessedPaper(initialPackage);
  const errorCount = normalized.validationIssues.filter((issue) => issue.level === "error").length;
  const warningCount = normalized.validationIssues.length - errorCount;

  if (errorCount > 0) {
    logValidationFailure(
      "paper-processing",
      `${errorCount} blocking issue(s) detected for ${input.paperFileName}`,
    );
  }

  logParsingEvent("paper_processing_completed", {
    instituteId: input.instituteId,
    paperFileName: input.paperFileName,
    pages: normalized.extractionSummary.pages,
    extractedChars: normalized.extractionSummary.extractedChars,
    usedOCR: normalized.extractionSummary.usedOCR,
    totalQuestions: normalized.totalQuestions,
    totalSections: normalized.sections.length,
    answerMappings: answerKey.size,
    unmatchedAnswerCount: unmatchedAnswers.length,
    duplicateAnswerCount: duplicateAnswers.length,
    warnings: normalized.extractionSummary.warnings,
    errors: errorCount,
  });

  return {
    ...normalized,
    processingLog: makeLog(
      normalized.processingLog,
      `Validation completed with ${errorCount} error(s) and ${warningCount} warning(s).`,
    ),
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
      chapter: meta.chapter ?? "General",
      topic: meta.topic ?? "General",
      difficulty: mapDifficulty(meta.difficulty),
      questionType: "NUMERICAL",
      questionText: meta.questionText,
      options: [],
      correctAnswer: meta.correctAnswer,
      solution: meta.solution ?? "",
      marks: meta.marks,
      negativeMarks: meta.negativeMarks,
      metadata: meta.metadata,
      createdAt: now,
      updatedAt: now,
    };
  }
  const labels = ["A", "B", "C", "D"];
  return {
    id: bankId,
    subject: meta.subject,
    chapter: meta.chapter ?? "General",
    topic: meta.topic ?? "General",
    difficulty: mapDifficulty(meta.difficulty),
    questionType: "MCQ_SINGLE",
    questionText: meta.questionText,
    options: labels.map((label, index) => ({
      label,
      text: meta.optionLabels[index] ?? "",
    })),
    correctAnswer: meta.correctAnswer,
    solution: meta.solution ?? "",
    marks: meta.marks,
    negativeMarks: meta.negativeMarks,
    metadata: meta.metadata,
    createdAt: now,
    updatedAt: now,
  };
}
