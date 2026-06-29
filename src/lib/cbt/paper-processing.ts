import {
  logParsingEvent,
  logParsingWarning,
  logUploadEvent,
  logValidationFailure,
} from "@/lib/logging/runtime-logger";
import { toNormalizedQuestion, fromNormalizedQuestion } from "@/lib/cbt/normalized-question";
import { applySubjectMapping, defaultSubjectMapping } from "@/lib/cbt/subject-mapping";
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
const DIAGRAM_NOTICE = "\n\n[📷 Diagram — refer to original PDF]";

type SupportedFileType = SupportedPaperFileType;

interface QuestionBlock {
  questionNumber: number;
  section: string;
  lines: string[];
  forceNumerical?: boolean;
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

type QuestionTypeDetection = {
  type: PreparedQuestionMeta["questionType"];
  detectionSource: NonNullable<PreparedQuestionMeta["detectionSource"]>;
};

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
    .replace(/[\u0000\uFEFF\u200B]/g, " ")
    .replace(/\r/g, "\n")
    .replace(/Page\s+\d+\s+of\s+\d+/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/www\.\S+/gi, " ")
    .replace(/\S+@\S+\.\S+/gi, " ")
    .replace(/\u00a9.*$/gim, " ")
    .replace(/©.*$/gim, " ")
    .replace(/all rights reserved.*/gi, " ")
    .replace(/[-_]{3,}/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .trim()
    .split("\n")
    .filter((line) => !/^[\s\d.\-|#*]{1,3}$/.test(line))
    .join("\n")
    .trim();
}

function sanitizeLine(text: string): string {
  if (/[\\∫∑∆→⇒θαβγλ$]/.test(text) || /\[Figure\s*\d*\]|\[Diagram\]|see figure/i.test(text)) {
    return text.trim();
  }
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
    line.match(/^q(?:uestion)?\s*\.?\s*(\d{1,3})[:.)\-\s]+\s*(.*)$/i) ??
    line.match(/^que\.?\s*(\d{1,3})[:.)\-\s]+\s*(.*)$/i)
  );
}

function looksLikeSectionHeader(line: string): string | null {
  const named = line.match(/^section\s+[a-z0-9]+\s*[:.-]\s*(.+)$/i);
  if (named?.[1]) return sanitizeLine(named[1]);
  const part = line.match(/^(?:part|paper)\s*[-:]?\s*([a-z])\s*[:.-]?\s*(.+)$/i);
  if (part?.[2]) return sanitizeLine(part[2]);
  const subject = SUBJECTS.find((item) => item.toLowerCase() === line.toLowerCase());
  return subject ?? null;
}

function sectionForcesNumerical(line: string): boolean {
  return /\b(integer type|numerical|nat|section\s+b|section\s+c|section\s+ii|section\s+iii|part\s+b|part\s+c)\b/i.test(
    line,
  );
}

function isAnswerLine(line: string): boolean {
  return /^(?:answer|ans)\s*[:.-]/i.test(line);
}

function parseQuestionBlocks(text: string): QuestionBlock[] {
  const lines = normalizeText(text)
    .split("\n")
    .map((line) => sanitizeLine(line))
    .filter(Boolean);
  const blocks: QuestionBlock[] = [];
  let currentSection = "Imported Questions";
  let currentSectionIsNumerical = false;
  let active: QuestionBlock | null = null;

  for (const line of lines) {
    const section = looksLikeSectionHeader(line);
    if (section) {
      currentSection = section;
      currentSectionIsNumerical = sectionForcesNumerical(line);
      continue;
    }

    const start = looksLikeQuestionStart(line);
    if (start) {
      const questionNumber = Number(start[1]);
      if (active && questionNumber !== active.questionNumber + 1) {
        active.lines.push(line);
        continue;
      }
      if (active && !active.lines.some((activeLine) => activeLine.trim())) {
        active.lines.push(line);
        continue;
      }
      if (active) blocks.push(active);
      active = {
        questionNumber,
        section: currentSection,
        forceNumerical: currentSectionIsNumerical,
        lines: [sanitizeLine(start[2])].filter(Boolean),
      };
      continue;
    }

    if (active) active.lines.push(line);
  }

  if (active) blocks.push(active);
  return blocks;
}

const OPTION_START =
  /^[\(\[]?([A-D])[\)\].:\-]\s*(.+)$/i;
const OPTION_WORD =
  /^option\s+([A-D])[:.)\-\s]+\s*(.+)$/i;

function parseInlineOptions(text: string): ParsedOption[] {
  const matches = [
    ...text.matchAll(/(?:^|\s)([A-D])[\).:-]\s*(.+?)(?=(?:\s+[A-D][\).:-]\s*)|$)/gi),
    ...text.matchAll(/(?:^|\s)[\(\[]([A-D])[\)\]]\s*(.+?)(?=(?:\s+[\(\[][A-D][\)\]]\s*)|$)/gi),
  ];
  return matches.map((match) => ({
    label: match[1].toUpperCase(),
    text: sanitizeLine(match[2]),
  }));
}

function stripInlineOptionsFromStem(text: string): string {
  return sanitizeLine(
    text
      .replace(/(?:^|\s)([A-D])[\).:-]\s*.+?(?=(?:\s+[A-D][\).:-]\s+)|$)/gi, " ")
      .replace(/(?:^|\s)[\(\[][A-D][\)\]]\s*.+?(?=(?:\s+[\(\[][A-D][\)\]]\s*)|$)/gi, " "),
  );
}

function splitStemAndInlineOptions(line: string): { stemPart: string; options: ParsedOption[] } {
  const marker = line.search(/(?:^|\s)(?:[A-D][\).:-]|[\(\[][A-D][\)\]])\s*/i);
  if (marker < 0) {
    return { stemPart: sanitizeLine(line), options: [] };
  }
  const stemPart = sanitizeLine(line.slice(0, marker));
  const options = parseInlineOptions(line.slice(marker));
  return { stemPart, options };
}

function isOptionStartLine(line: string): { label: string; text: string } | null {
  const direct = line.match(OPTION_START) ?? line.match(OPTION_WORD);
  if (direct) {
    return { label: direct[1].toUpperCase(), text: sanitizeLine(direct[2] ?? "") };
  }
  const bare = line.match(/^[\(\[]?([A-D])[\)\].:-]\s*$/i);
  if (bare) {
    return { label: bare[1].toUpperCase(), text: "" };
  }
  return null;
}

function hasValidMcqOptions(options: ParsedOption[]): boolean {
  if (options.length < 2) return false;
  const labels = new Set(options.map((option) => option.label));
  if (labels.size !== options.length) return false;
  return options.every((option) => option.text.trim().length > 0);
}

export function isNumericAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  if (!trimmed) return false;
  return /^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(trimmed);
}

function looksLikeNumericalStem(text: string): boolean {
  return /\b(find|calculate|value of|the value|integer|numerical|nearest integer|integral|evaluate|solve for)\b/i.test(
    text,
  );
}

/** MCQ when valid options exist; numerical only without options and a numeric (or clear numerical) stem. */
export function resolveQuestionType(
  options: ParsedOption[],
  correctAnswer: string,
  stem: string,
  forceNumerical?: boolean,
): QuestionTypeDetection {
  if (forceNumerical) return { type: "NUMERICAL", detectionSource: "section_header" };
  if (hasValidMcqOptions(options)) return { type: "MCQ_SINGLE", detectionSource: "options_present" };
  if (isNumericAnswer(correctAnswer)) return { type: "NUMERICAL", detectionSource: "answer_key_numeric" };
  if (/^[A-D]$/i.test(correctAnswer.trim())) return { type: "MCQ_SINGLE", detectionSource: "answer_key_letter" };
  if (!correctAnswer.trim() && looksLikeNumericalStem(stem)) {
    return { type: "NUMERICAL", detectionSource: "stem_keywords" };
  }
  return { type: "MCQ_SINGLE", detectionSource: "fallback" };
}

function parseOptions(lines: string[]): { options: ParsedOption[]; stemLines: string[] } {
  const options: ParsedOption[] = [];
  const stemLines: string[] = [];
  let activeOption: ParsedOption | null = null;
  let seenOption = false;

  const flushActiveOption = () => {
    if (!activeOption) return;
    options.push({
      label: activeOption.label,
      text: sanitizeLine(activeOption.text),
    });
    activeOption = null;
  };

  for (const line of lines) {
    if (isAnswerLine(line)) continue;

    const start = isOptionStartLine(line);
    if (start) {
      seenOption = true;
      flushActiveOption();
      activeOption = { label: start.label, text: start.text };
      continue;
    }

    const inlineSplit = splitStemAndInlineOptions(line);
    if (inlineSplit.options.length >= 2) {
      seenOption = true;
      flushActiveOption();
      options.push(...inlineSplit.options);
      if (inlineSplit.stemPart) stemLines.push(inlineSplit.stemPart);
      continue;
    }

    if (activeOption && seenOption && !looksLikeQuestionStart(line)) {
      activeOption = {
        ...activeOption,
        text: `${activeOption.text} ${sanitizeLine(line)}`,
      };
      continue;
    }

    if (!seenOption) {
      const earlyInline = splitStemAndInlineOptions(line);
      if (earlyInline.options.length >= 2) {
        seenOption = true;
        flushActiveOption();
        options.push(...earlyInline.options);
        if (earlyInline.stemPart) stemLines.push(earlyInline.stemPart);
        continue;
      }
    }

    stemLines.push(line);
  }

  flushActiveOption();

  const deduped = dedupeOptions(options);
  if (deduped.length >= 2) {
    return { options: deduped, stemLines };
  }

  const combinedStem = stemLines.join(" ");
  const inlineFromStem = dedupeOptions(parseInlineOptions(combinedStem));
  if (hasValidMcqOptions(inlineFromStem)) {
    return {
      options: inlineFromStem,
      stemLines: [stripInlineOptionsFromStem(combinedStem)],
    };
  }

  return { options: deduped, stemLines };
}

function dedupeOptions(options: ParsedOption[]): ParsedOption[] {
  const byLabel = new Map<string, ParsedOption>();
  for (const option of options) {
    byLabel.set(option.label, option);
  }
  return ["A", "B", "C", "D"]
    .map((label) => byLabel.get(label))
    .filter((option): option is ParsedOption => Boolean(option?.text.trim()));
}

function detectSubject(section: string): string {
  const exact = SUBJECTS.find((subject) => section.toLowerCase().includes(subject.toLowerCase()));
  if (exact) return exact;
  if (section !== "Imported Questions") return section;
  return "Imported Questions";
}

function normalizeAnswerKeyText(text: string): string {
  return normalizeText(text)
    .replace(/(\d{1,3})\s*,\s*([A-Da-d])/g, "$1,$2")
    .replace(/(\d{1,3})\s*,\s*(-?\d)/g, "$1,$2")
    .replace(/[|;/\\]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ");
}

function parseAnswerKeyEntries(text?: string): ParsedAnswerEntry[] {
  if (!text) return [];
  const normalized = normalizeAnswerKeyText(text);
  const entries: ParsedAnswerEntry[] = [];
  const seen = new Set<number>();

  const patterns = [
    // Explicit arrow separator: 5->C or 5->42  (must come first — most specific)
    /(?:^|[\s\n])(?:q(?:uestion)?|que\.?)?\s*#?\s*(\d{1,3})\s*->\s*\(?\s*([A-D])\s*\)?(?![A-Za-z])/gim,
    /(?:^|[\s\n])(?:q(?:uestion)?|que\.?)?\s*#?\s*(\d{1,3})\s*->\s*\(?\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*\)?/gim,
    // Dash / colon / comma separators: 1-A, 6: D, 4,C
    /(?:^|[\s\n])(?:q(?:uestion)?|que\.?)?\s*#?\s*(\d{1,3})\s*(?:[-–]|[:.,])\s*\(?\s*([A-D])\s*\)?(?![A-Za-z])/gim,
    /(?:^|[\s\n])(?:q(?:uestion)?|que\.?)?\s*#?\s*(\d{1,3})\s*(?:[-–]|[:.,])\s*\(?\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*\)?/gim,
    // Space-surrounded dash: 7 - 42
    /(?:^|[\s\n])(?:q(?:uestion)?|que\.?)?\s*#?\s*(\d{1,3})\s+-\s+([A-D])(?![A-Za-z])/gim,
    /(?:^|[\s\n])(?:q(?:uestion)?|que\.?)?\s*#?\s*(\d{1,3})\s+-\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)/gim,
    // Period separator: 2. B
    /(?:^|[\s\n])(\d{1,3})\.\s*\(?\s*([A-D])\s*\)?(?![A-Za-z])/gim,
    /(?:^|[\s\n])(\d{1,3})\.\s*\(?\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*\)?/gim,
    // Bare space: 3 A (only at line start to avoid false positives)
    /^(\d{1,3})\s+([A-D])(?![A-Za-z])/gim,
    /^(\d{1,3})\s+(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?!\S)/gim,
    // Comma-separated: 4,C
    /(?:^|[\s\n])(\d{1,3})\s*,\s*\(?\s*([A-D])\s*\)?(?![A-Za-z])/gim,
    /(?:^|[\s\n])(\d{1,3})\s*,\s*\(?\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*\)?/gim,
  ];

  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const questionNumber = Number(match[1]);
      if (!Number.isFinite(questionNumber) || questionNumber < 1 || seen.has(questionNumber)) {
        continue;
      }
      const answer = match[2].toUpperCase();
      seen.add(questionNumber);
      entries.push({
        questionNumber,
        answer,
        raw: sanitizeLine(match[0]),
      });
    }
  }

  const lines = normalized.split("\n").map((line) => sanitizeLine(line)).filter(Boolean);
  for (const line of lines) {
    // Treat comma, tab, or double spaces as delimiters. Strip quotes.
    const cells = line
      .split(/\s{2,}|\t+|,/)
      .map((cell) => sanitizeLine(cell.replace(/["']/g, "")))
      .filter(Boolean);
    if (cells.length >= 2) {
      const qCell = cells[0].replace(/[.\)]$/, "");
      const qMatch = qCell.match(/^(\d{1,3})$/);
      const aMatch = cells[1].match(/^\(?\s*([A-D]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*\)?$/i);
      if (qMatch && aMatch) {
        const questionNumber = Number(qMatch[1]);
        if (!seen.has(questionNumber)) {
          seen.add(questionNumber);
          entries.push({
            questionNumber,
            answer: aMatch[1].toUpperCase(),
            raw: line,
          });
        }
      }
    }
  }

  return entries.sort((a, b) => a.questionNumber - b.questionNumber);
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

function computeConfidence(input: {
  questionText: string;
  optionCount: number;
  correctAnswer: string;
  extractionMode: UploadExtractionMode;
  usedOCR: boolean;
  isMcq: boolean;
}): number {
  let confidence = 0.25;
  if (input.questionText.length > 20) confidence += 0.25;
  if (input.isMcq && input.optionCount >= 4) confidence += 0.25;
  else if (input.isMcq && input.optionCount >= 2) confidence += 0.12;
  else if (!input.isMcq && input.questionText.length > 10) confidence += 0.15;
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
  const { options, stemLines } = parseOptions(block.lines);
  const blockText = block.lines.join(" ");
  const hasImage = /\[Figure\b|\[Diagram\b|see figure/i.test(blockText);
  const baseQuestionText = sanitizeLine(stemLines.join(" "));
  const questionText =
    hasImage && !baseQuestionText.includes(DIAGRAM_NOTICE)
      ? `${baseQuestionText}${DIAGRAM_NOTICE}`
      : baseQuestionText;
  const hasEquation = /\\frac|\\sqrt|\\[a-zA-Z]+|\$[^$]+\$|\\\(|\\\[|\^[{0-9]|_[{0-9]/.test(
    `${questionText} ${blockText}`,
  );
  const inlineAnswer = parseInlineAnswer(block.lines);
  let correctAnswer = answerKey.get(block.questionNumber) ?? inlineAnswer;
  const { type: questionType, detectionSource } = resolveQuestionType(
    options,
    correctAnswer,
    questionText,
    block.forceNumerical,
  );
  const isMcq = questionType === "MCQ_SINGLE";

  if (isMcq && /^[1-4]$/.test(correctAnswer.trim())) {
    const idx = parseInt(correctAnswer.trim(), 10) - 1;
    correctAnswer = ["A", "B", "C", "D"][idx];
  }

  const optionLabels = isMcq ? options.map((option) => option.text) : [];
  if (isMcq) {
    while (optionLabels.length < 4) {
      optionLabels.push("");
    }
  }

  const confidence = computeConfidence({
    questionText,
    optionCount: optionLabels.length,
    correctAnswer,
    extractionMode,
    usedOCR,
    isMcq,
  });

  const meta: PreparedQuestionMeta = {
    questionId: `${pkgId}-q-${block.questionNumber}`,
    sequence: block.questionNumber,
    subject: detectSubject(block.section),
    section: block.section,
    chapter: undefined,
    topic: undefined,
    difficulty: undefined,
    confidence,
    questionType,
    detectionSource,
    questionText,
    hasEquation,
    hasImage,
    correctAnswer,
    solution: undefined,
    marks: 4,
    negativeMarks: 1,
    optionLabels,
    images: [],
    explanation: undefined,
    metadata: {
      parser: "deterministic_v3",
      sourceQuestionNumber: block.questionNumber,
      answerKeySource: answerKey.has(block.questionNumber)
        ? "answer_key_file"
        : inlineAnswer
          ? "inline_paper"
          : "missing",
      detectedQuestionType: questionType,
      detectionSource,
      hasImage,
    },
  };

  return fromNormalizedQuestion(toNormalizedQuestion(meta), {
    sequence: meta.sequence,
    section: meta.section,
    marks: meta.marks,
    negativeMarks: meta.negativeMarks,
    detectionSource: meta.detectionSource,
    hasEquation: meta.hasEquation,
    hasImage: meta.hasImage,
    metadata: meta.metadata,
  });
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
    detectionSource: "fallback",
    questionText: "",
    hasEquation: false,
    hasImage: false,
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
    issues.push({ level: "warning", message: "Test title is required." });
  }
  if (pkg.sections.length === 0) {
    issues.push({ level: "warning", message: "No sections were created from the uploaded paper." });
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
      issues.push({ level: "warning", section: section.name, message: "Section name is required." });
    }
    for (const question of section.questions) {
      const normalized = toNormalizedQuestion(question);
      if (!normalized.id.trim()) {
        issues.push({
          level: "warning",
          section: section.name,
          message: `Question ${question.sequence} is missing a stable question id.`,
        });
      } else if (seenQuestionIds.has(normalized.id)) {
        issues.push({
          level: "warning",
          code: "duplicate_id",
          questionId: normalized.id,
          section: section.name,
          message: `Question ${question.sequence} has a duplicate question id.`,
        });
      } else {
        seenQuestionIds.add(normalized.id);
      }
      if (!normalized.stem.trim() && question.detectionSource !== "vision_crop") {
        issues.push({
          level: "warning",
          questionId: normalized.id,
          section: section.name,
          message: `Question ${question.sequence} is missing question text.`,
        });
      }
      if (normalized.type === "MCQ_SINGLE") {
        const requiredOptionLabels = ["A", "B", "C", "D"];
        
        if (question.detectionSource !== "vision_crop") {
          for (const [optionIndex, label] of requiredOptionLabels.entries()) {
            if (!normalized.options[optionIndex]?.trim() && !question.optionImages?.[optionIndex]) {
              issues.push({
                level: "warning",
                code: "malformed_options",
                questionId: normalized.id,
                section: section.name,
                message: `Question ${question.sequence} has an empty option ${label}.`,
              });
            }
          }
          if (normalized.options.filter((option, index) => option.trim() || question.optionImages?.[index]).length < requiredOptionLabels.length) {
            issues.push({
              level: "warning",
              code: "malformed_options",
              questionId: normalized.id,
              section: section.name,
              message: `Question ${question.sequence} needs four complete options.`,
            });
          }
        }
        
        const answerIndex = requiredOptionLabels.indexOf(normalized.answer.toUpperCase());
        if (answerIndex < 0 || (question.detectionSource !== "vision_crop" && !normalized.options[answerIndex]?.trim() && !question.optionImages?.[answerIndex])) {
          issues.push({
            level: "warning",
            code: "missing_answer",
            questionId: normalized.id,
            section: section.name,
            message: `Question ${question.sequence} is missing a valid answer key.`,
          });
        }
      } else if (!normalized.answer.trim()) {
        issues.push({
          level: "warning",
          code: "missing_answer",
          questionId: normalized.id,
          section: section.name,
          message: `Question ${question.sequence} is missing a numerical answer.`,
        });
      } else if (!isNumericAnswer(normalized.answer)) {
        issues.push({
          level: "warning",
          code: "missing_answer",
          questionId: normalized.id,
          section: section.name,
          message: `Question ${question.sequence} needs a numeric answer.`,
        });
      }
      if (!normalized.subject.trim() || normalized.subject === "Imported Questions") {
        issues.push({
          level: "warning",
          questionId: normalized.id,
          section: section.name,
          message: `Question ${question.sequence} needs subject review.`,
        });
      }
      if (normalized.confidence < 0.45) {
        issues.push({
          level: "warning",
          questionId: normalized.id,
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
  const withSubjects = applySubjectMapping(pkg);
  const sections = withSubjects.sections
    .map((section, sectionIndex) => ({
      ...section,
      id: `section-${slug(section.name || String(sectionIndex + 1)) || sectionIndex + 1}`,
      questions: section.questions.map((question, questionIndex) => {
        const normalized = toNormalizedQuestion({
          ...question,
          sequence: questionIndex + 1,
          section: section.name,
          questionText: sanitizeLine(question.questionText),
          optionLabels: question.optionLabels.map((option) => sanitizeLine(option)),
        });
        return fromNormalizedQuestion(normalized, {
          sequence: questionIndex + 1,
          section: section.name,
          marks: question.marks,
          negativeMarks: question.negativeMarks,
          detectionSource: question.detectionSource,
          hasEquation: question.hasEquation,
          hasImage: question.hasImage,
          stemImage: question.stemImage,
          optionImages: question.optionImages,
          images: question.images,
          metadata: question.metadata,
          _debug_source: (question as any)._debug_source,
          _debug_assets: (question as any)._debug_assets,
        });
      }),
    }))
    .filter((section) => section.questions.length > 0 || sectionIndexIsFirst(section, withSubjects.sections));
  const totalQuestions = sections.reduce((count, section) => count + section.questions.length, 0);
  const totalMarks = sections.reduce(
    (count, section) =>
      count + section.questions.reduce((sum, question) => sum + Math.max(0, question.marks), 0),
    0,
  );
  const normalized = {
    ...withSubjects,
    status: "DRAFT_REVIEW" as const,
    sections,
    totalQuestions,
    totalMarks,
    extractionSummary: {
      ...withSubjects.extractionSummary,
      questionsDetected: totalQuestions,
    },
    subjectMapping:
      withSubjects.subjectMapping ?? defaultSubjectMapping(totalQuestions, "full"),
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

// runPaperProcessing removed to deprecate legacy extraction path

export function inferQuestionTypeFromMeta(meta: PreparedQuestionMeta): "MCQ_SINGLE" | "NUMERICAL" {
  const options: ParsedOption[] = meta.optionLabels
    .map((text, index) => ({
      label: (["A", "B", "C", "D"][index] ?? "A") as string,
      text,
    }))
    .filter((option) => option.text.trim());
  return resolveQuestionType(options, meta.correctAnswer, meta.questionText).type;
}

/** Test helper: parse answer key text. */
export function parseAnswerKeyForTest(text: string) {
  return parseAnswerKeyEntries(text);
}

/** Test helper: parse paper text synchronously without upload metadata. */
export function parsePaperTextForTest(
  paperText: string,
  answerKeyText?: string,
): PreparedQuestionMeta[] {
  const id = "test-paper";
  const blocks = parseQuestionBlocks(paperText);
  const answerEntries = parseAnswerKeyEntries(answerKeyText);
  const { mappedAnswers: answerKey } = mapAnswerEntries(answerEntries, blocks);
  return blocks.map((block) => buildQuestionMeta(id, block, answerKey, "manual", false));
}

export function preparedMetaToBankQuestion(
  meta: PreparedQuestionMeta,
  packageId: string,
): BankQuestion {
  const now = Date.now();
  const bankId = `${packageId}-bank-${meta.questionId}`;
  const normalized = toNormalizedQuestion(meta);

  if (normalized.type === "NUMERICAL") {
    return {
      id: bankId,
      subject: normalized.subject,
      chapter: meta.chapter ?? "General",
      topic: meta.topic ?? "General",
      difficulty: mapDifficulty(meta.difficulty),
      questionType: "NUMERICAL",
      questionText: normalized.stem,
      stemImage: meta.stemImage,
      options: [],
      correctAnswer: normalized.answer,
      solution: meta.solution ?? "",
      marks: meta.marks,
      negativeMarks: meta.negativeMarks,
      metadata: meta.metadata,
      createdAt: now,
      updatedAt: now,
      images: meta.images || [],
      _debug_source: (meta as any)._debug_source,
      _debug_assets: (meta as any)._debug_assets,
    } as any;
  }

  const options: BankQuestion["options"] = [];
  for (const [index, label] of ["A", "B", "C", "D"].entries()) {
    const text = normalized.options[index]?.trim();
    const image = (meta as any).optionImages?.[index];
    if (text || image || meta.detectionSource === "vision_crop") {
      options.push({ label, text: text || "", image });
    }
  }

  return {
    id: bankId,
    subject: normalized.subject,
    chapter: meta.chapter ?? "General",
    topic: meta.topic ?? "General",
    difficulty: mapDifficulty(meta.difficulty),
    questionType: "MCQ_SINGLE",
    questionText: normalized.stem,
    stemImage: meta.stemImage,
    options,
    correctAnswer: normalized.answer,
    solution: meta.solution ?? "",
    marks: meta.marks,
    negativeMarks: meta.negativeMarks,
    metadata: meta.metadata,
    createdAt: now,
    updatedAt: now,
  };
}


