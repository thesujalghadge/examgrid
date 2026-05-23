/** Prepared during paper processing — groundwork for future L1/L2/L3 analytics. */
export type PreparedDifficulty = "L1" | "L2" | "L3";

export interface PreparedQuestionMeta {
  questionId: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: PreparedDifficulty;
  questionType: "MCQ_SINGLE" | "NUMERICAL";
  questionText: string;
  correctAnswer: string;
  solution: string;
  marks: number;
  negativeMarks: number;
  optionLabels?: string[];
}

export interface PreparedSectionMeta {
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
