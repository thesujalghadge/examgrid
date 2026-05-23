/** Prepared during paper processing. */
export type PreparedDifficulty = "L1" | "L2" | "L3";
export type UploadExtractionMode = "file" | "manual" | "hybrid";

export interface ProcessedPaperValidationIssue {
  level: "warning" | "error";
  message: string;
  questionId?: string;
  section?: string;
}

export interface PreparedQuestionMeta {
  questionId: string;
  sequence: number;
  subject: string;
  section: string;
  chapter?: string;
  topic?: string;
  difficulty?: PreparedDifficulty;
  questionType: "MCQ_SINGLE" | "NUMERICAL";
  questionText: string;
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

export interface ProcessedPaperPackage {
  id: string;
  title: string;
  instituteId: string;
  paperFileName: string;
  paperFileType: "pdf" | "doc" | "docx";
  answerKeyFileName?: string;
  answerKeyFileType?: "csv" | "doc" | "docx";
  durationMinutes: number;
  instructions: string[];
  sections: PreparedSectionMeta[];
  processingLog: string[];
  validationIssues: ProcessedPaperValidationIssue[];
  extractionMode: UploadExtractionMode;
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
