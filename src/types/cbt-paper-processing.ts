/** Prepared during paper processing. */
export type PreparedDifficulty = "L1" | "L2" | "L3";
export type UploadExtractionMode = "file" | "manual" | "hybrid" | "gemini_vision";
export type SupportedPaperFileType = "pdf" | "doc" | "docx" | "csv" | "xlsx" | "txt";

export interface PaperExtractionSummary {
  pages: number;
  extractedChars: number;
  usedOCR: boolean;
  questionsDetected: number;
  warnings: string[];
}

export interface AnswerKeyReviewItem {
  questionNumber: number;
  answer: string;
  reason: "duplicate" | "unmatched";
}

export interface PaperParsingDiagnostics {
  rawTextPreview: string;
  parsedQuestionCount: number;
  unmatchedAnswerCount: number;
  unmatchedAnswers: AnswerKeyReviewItem[];
  duplicateAnswers: AnswerKeyReviewItem[];
}

export type ProcessedPaperValidationCode =
  | "missing_answer"
  | "malformed_options"
  | "duplicate_id";

export interface ProcessedPaperValidationIssue {
  level: "warning" | "error";
  message: string;
  code?: ProcessedPaperValidationCode;
  questionId?: string;
  section?: string;
}

export type ProcessedPaperStatus = "DRAFT_REVIEW" | "READY_TO_PUBLISH" | "PUBLISHED";

export interface PreparedQuestionMeta {
  questionId: string;
  sequence: number;
  subject: string;
  section: string;
  chapter?: string;
  topic?: string;
  difficulty?: PreparedDifficulty;
  confidence: number;
  questionType: "MCQ_SINGLE" | "NUMERICAL";
  detectionSource?:
    | "options_present"
    | "answer_key_letter"
    | "answer_key_numeric"
    | "section_header"
    | "stem_keywords"
    | "fallback"
    | "gemini_vision";
  questionText: string;
  hasEquation?: boolean;
  hasImage?: boolean;
  stemImage?: string;
  optionImages?: string[];
  correctAnswer: string;
  solution?: string;
  marks: number;
  negativeMarks: number;
  optionLabels: string[];
  images: string[];
  explanation?: string;
  metadata: Record<string, string | number | boolean | null>;
}

export interface PreparedSectionMeta {
  id: string;
  name: string;
  questions: PreparedQuestionMeta[];
}

export type SubjectMappingMode = "single" | "multi";

/** How the teacher assigns subjects before publishing. */
export type SubjectPaperLayout = "single" | "two" | "full";

export interface SubjectRangeMapping {
  start: number;
  end: number;
  subject: string;
}

export interface PaperSubjectMapping {
  layout: SubjectPaperLayout;
  mode: SubjectMappingMode;
  singleSubject?: string;
  ranges?: SubjectRangeMapping[];
  appliedAt?: number;
}

export interface ProcessedPaperPackage {
  id: string;
  status: ProcessedPaperStatus;
  title: string;
  instituteId: string;
  subjectMapping?: PaperSubjectMapping;
  paperFileName: string;
  paperFileType: SupportedPaperFileType;
  answerKeyFileName?: string;
  answerKeyFileType?: SupportedPaperFileType;
  durationMinutes: number;
  instructions: string[];
  sections: PreparedSectionMeta[];
  processingLog: string[];
  validationIssues: ProcessedPaperValidationIssue[];
  extractionMode: UploadExtractionMode;
  extractionSummary: PaperExtractionSummary;
  parsingDiagnostics: PaperParsingDiagnostics;
  preparedAt: number;
  totalMarks: number;
  totalQuestions: number;
}

export type PaperProcessingStage =
  | "extracting_questions"
  | "mapping_sections"
  | "detecting_subjects"
  | "mapping_answers"
  | "building_preview"
  | "preparing_analytics_metadata";
