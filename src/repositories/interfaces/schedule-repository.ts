import type { ExamSchedule } from "@/types/institute-ops";

export interface ScheduleRepository {
  list(): ExamSchedule[];
  getById(id: string): ExamSchedule | undefined;
  listByExamId(examId: string): ExamSchedule[];
  save(schedule: ExamSchedule): void;
  deactivate(id: string): void;
  delete(id: string): void;
}
