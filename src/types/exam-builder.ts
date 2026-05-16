import type { ExamDefinition } from "@/types/exam";

export interface ExamSectionDraft {
  id: string;
  name: string;
  questionIds: string[];
}

export interface ExamBuildDraft {
  id?: string;
  title: string;
  subtitle: string;
  examType: ExamDefinition["examType"];
  durationMinutes: number;
  scheduledAt: string;
  instructions: string[];
  sections: ExamSectionDraft[];
}

export const SECTION_PRESETS = [
  "Physics",
  "Chemistry",
  "Mathematics",
  "Biology",
] as const;
