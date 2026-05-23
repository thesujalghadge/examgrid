import {
  logParsingEvent,
  logParsingWarning,
  logUploadEvent,
  logValidationFailure,
} from "@/lib/logging/runtime-logger";
import type {
  PaperProcessingStage,
  PreparedQuestionMeta,
  ProcessedPaperPackage,
  ProcessedPaperValidationIssue,
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
const DEFAULT_DURATION_MINUTES = 60;
const SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"] as const;
const SUBJECT_KEYWORDS: Array<{ subject: string; keywords: string[] }> = [
  {
    subject: "Physics",
    keywords: ["velocity", "force", "current", "acceleration", "newton", "motion"],
  },
  {
    subject: "Chemistry",
    keywords: ["mole", "reaction", "equilibrium", "acid", "base", "atom"],
  },
  {
    subject: "Mathematics",
    keywords: ["integral", "derivative", "quadratic", "triangle", "probability", "matrix"],
  },
  {
    subject: "Biology",
    keywords: ["cell", "organism", "enzyme", "genetics", "photosynthesis"],
  },
];

function mapDifficulty(
  difficulty: "L1" | "L2" | "L3" | undefined,
): "easy" | "medium" | "hard" {
  if (difficulty === "L1") return "easy";
  if (difficulty === "L3") return "hard";
  return "medium";
}

type SupportedFileType = "pdf" | "doc" | "docx" | "csv";

interface QuestionBlock {
  questionNumber: number;
  section: string;
  lines: string[];
}

interface ParsedOption {
  label: string;
  text: string;
}

interface ParsePaperInput {
  instituteId: string;
  paperFileName: string;
  paperFileType: "pdf" | "doc" | "docx";
  paperText: string;
  answerKeyFileName?: string;
  answerKeyFileType?: "csv" | "doc" | "docx";
  answerKeyText?: string;
  extractionMode: UploadExtractionMode;
  onStage?: (stage: PaperProcessingStage, log: string[]) => void;
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

function makeLog(log: string[], message: string): string[] {
  const entry = `${new Date().toISOString()} ${message}`;
  log.push(entry);
  return [...log];
}

function sanitizeLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function looksLikeQuestionStart(line: string): RegExpMatchArray | null {
  return line.match(/^(?:q(?:uestion)?\s*)?(\d{1,3})[\).:-]\s*(.+)$/i);
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
  let currentSection = "General";
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
  const matches = [...text.matchAll(/(?:^|\s)([A-D])[\).:-]\s*(.+?)(?=(?:\s+[A-D][\).:-]\s+)|$)/g)];
  return matches.map((match) => ({
    label: match[1].toUpperCase(),
    text: sanitizeLine(match[2]),
  }));
}

function parseOptions(lines: string[]): { options: ParsedOption[]; remaining: string[] } {
  const options: ParsedOption[] = [];
  const remaining: string[] = [];

  for (const line of lines) {
    const direct = line.match(/^[\(\[]?([A-D])[\)\].:-]\s*(.+)$/i);
    if (direct) {
      options.push({
        label: direct[1].toUpperCase(),
        text: sanitizeLine(direct[2]),
      });
      continue;
    }

    const inline = parseInlineOptions(line);
    if (inline.length >= 2) {
      options.push(...inline);
      continue;
    }

    remaining.push(line);
  }

  return { options, remaining };
}

function detectSubject(section: string, text: string): string {
  const exact = SUBJECTS.find((subject) => section.toLowerCase().includes(subject.toLowerCase()));
  if (exact) return exact;
  const lowered = text.toLowerCase();
  for (const { subject, keywords } of SUBJECT_KEYWORDS) {
    if (keywords.some((keyword) => lowered.includes(keyword))) return subject;
  }
  return section === "General" ? "General" : section;
}

function parseAnswerKey(text?: string): Map<number, string> {
  const mapping = new Map<number, string>();
  if (!text) return mapping;
  const normalized = normalizeText(text);
  const compactMatches = [...normalized.matchAll(/(\d{1,3})\s*[-:=]?\s*([A-D]|-?\d+(?:\.\d+)?)/gi)];
  for (const match of compactMatches) {
    mapping.set(Number(match[1]), match[2].toUpperCase());
  }
  return mapping;
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

function buildQuestionMeta(
  pkgId: string,
  block: QuestionBlock,
  answerKey: Map<number, string>,
): PreparedQuestionMeta {
  const { options, remaining } = parseOptions(block.lines);
  const linesWithoutAnswers = remaining.filter(
    (line) => !/^(?:answer|ans)\s*[:.-]/i.test(line),
  );
  const questionText = sanitizeLine(linesWithoutAnswers.join(" "));
  const inlineAnswer = parseInlineAnswer(block.lines);
  const correctAnswer = answerKey.get(block.questionNumber) ?? inlineAnswer;
  const subject = detectSubject(block.section, questionText);

  return {
    questionId: `${pkgId}-q-${block.questionNumber}`,
    sequence: block.questionNumber,
    subject,
    section: block.section,
    chapter: undefined,
    topic: undefined,
    difficulty: undefined,
    questionType: options.length > 0 ? "MCQ_SINGLE" : "NUMERICAL",
    questionText,
    correctAnswer,
    solution: undefined,
    marks: 4,
    negativeMarks: 1,
    optionLabels: options.map((option) => option.text),
    images: [],
    explanation: undefined,
    metadata: {
      parser: "deterministic_v1",
      sourceQuestionNumber: block.questionNumber,
      answerKeySource: answerKey.has(block.questionNumber)
        ? "answer_key_file"
        : inlineAnswer
          ? "inline_paper"
          : "missing",
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

  return [...sectionMap.entries()].map(([name, rows]) => ({
    id: `section-${slug(name) || "general"}`,
    name,
    questions: rows.sort((a, b) => a.sequence - b.sequence),
  }));
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
      : lower.endsWith(".csv")
        ? "csv"
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
  if (normalized.length < 80) return false;
  const printable = normalized.replace(/[\sA-Za-z0-9,.;:(){}\[\]<>!?'"%+\-/*=&]/g, "");
  return printable.length / normalized.length < 0.15;
}

export function validateProcessedPaper(pkg: ProcessedPaperPackage): ProcessedPaperValidationIssue[] {
  const issues: ProcessedPaperValidationIssue[] = [];
  if (!pkg.title.trim()) {
    issues.push({ level: "error", message: "Test title is required." });
  }
  if (pkg.sections.length === 0) {
    issues.push({ level: "error", message: "No sections were created from the uploaded paper." });
  }

  for (const section of pkg.sections) {
    if (!section.name.trim()) {
      issues.push({ level: "error", section: section.name, message: "Section name is required." });
    }
    for (const question of section.questions) {
      if (!question.questionText.trim()) {
        issues.push({
          level: "error",
          questionId: question.questionId,
          section: section.name,
          message: `Question ${question.sequence} is missing question text.`,
        });
      }
      if (question.questionType === "MCQ_SINGLE") {
        if (question.optionLabels.filter((option) => option.trim()).length < 2) {
          issues.push({
            level: "error",
            questionId: question.questionId,
            section: section.name,
            message: `Question ${question.sequence} needs at least two options.`,
          });
        }
        const validLabel = /^[A-D]$/i.test(question.correctAnswer);
        if (!validLabel) {
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

      if (!question.subject.trim() || question.subject === "General") {
        issues.push({
          level: "warning",
          questionId: question.questionId,
          section: section.name,
          message: `Question ${question.sequence} needs subject review.`,
        });
      }
    }
  }

  return issues;
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
    .filter((section) => section.questions.length > 0);
  const totalQuestions = sections.reduce((count, section) => count + section.questions.length, 0);
  const totalMarks = sections.reduce(
    (count, section) =>
      count + section.questions.reduce((sum, question) => sum + Math.max(0, question.marks), 0),
    0,
  );
  const normalized = {
    ...pkg,
    sections,
    totalQuestions,
    totalMarks,
  };
  return {
    ...normalized,
    validationIssues: validateProcessedPaper(normalized),
  };
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
  if (questionBlocks.length === 0) {
    logParsingWarning("paper_parse_no_questions", {
      instituteId: input.instituteId,
      paperFileName: input.paperFileName,
    });
    throw new Error(
      "No numbered questions were found. Paste extracted text with lines like '1.' or 'Q1.' before processing.",
    );
  }

  const answerKey = parseAnswerKey(input.answerKeyText);
  const questions = questionBlocks.map((block) => buildQuestionMeta(id, block, answerKey));
  const sections = buildSections(questions);

  const initialPackage: ProcessedPaperPackage = {
    id,
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
    processingLog: makeLog(
      log,
      `Detected ${questions.length} questions across ${sections.length} section(s).`,
    ),
    validationIssues: [],
    extractionMode: input.extractionMode,
    preparedAt: Date.now(),
    totalMarks: 0,
    totalQuestions: 0,
  };

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
    totalQuestions: normalized.totalQuestions,
    totalSections: normalized.sections.length,
    answerMappings: answerKey.size,
    errors: errorCount,
    warnings: warningCount,
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
      text: meta.optionLabels[index] ?? `Option ${label}`,
    })),
    correctAnswer: meta.correctAnswer,
    solution: meta.solution ?? "",
    marks: meta.marks,
    negativeMarks: meta.negativeMarks,
    createdAt: now,
    updatedAt: now,
  };
}
