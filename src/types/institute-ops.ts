import type { ExamDefinition } from "@/types/exam";

export type CourseType = "JEE" | "NEET" | "CET" | "FOUNDATION" | string;

export interface InstituteStudent {
  id: string;
  instituteId?: string;
  fullName: string;
  email: string;
  phone: string;
  rollNumber: string;
  courseType: CourseType;
  batchId: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Batch {
  id: string;
  instituteId?: string;
  name: string;
  courseType: CourseType;
  academicYear: string;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ExamVisibilityRule = "assigned_batches" | "all_active_students";

export interface ExamSchedule {
  id: string;
  instituteId?: string;
  examId: string;
  batchIds: string[];
  startAt: string;
  endAt: string;
  durationMinutes: number;
  visibilityRule: ExamVisibilityRule;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ScheduledExamStatus = "upcoming" | "active" | "completed";

export interface ScheduledExamView {
  exam: ExamDefinition;
  schedule: ExamSchedule;
  status: ScheduledExamStatus;
}

export interface StudentImportPreviewRow {
  index: number;
  student: Omit<InstituteStudent, "id" | "createdAt" | "updatedAt">;
  duplicate: boolean;
  errors: string[];
}

export interface StudentImportPreview {
  rows: StudentImportPreviewRow[];
  validCount: number;
  duplicateCount: number;
  errorCount: number;
}
