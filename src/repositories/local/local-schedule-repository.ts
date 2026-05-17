import { readStorageJson, writeStorageJson } from "@/lib/storage/safe-json";
import {
  assertExamSchedule,
  parseExamScheduleList,
} from "@/lib/validation/institute-ops-schema";
import type { ScheduleRepository } from "@/repositories/interfaces/schedule-repository";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { ExamSchedule } from "@/types/institute-ops";

export class LocalScheduleRepository implements ScheduleRepository {
  list(): ExamSchedule[] {
    return readStorageJson({
      storage: "local",
      key: STORAGE_KEYS.schedules,
      fallback: [],
      validate: (data) => {
        const result = parseExamScheduleList(data);
        if (!result.success) {
          return {
            ok: false,
            error: result.error.issues.map((i) => i.message).join("; "),
          };
        }
        return { ok: true, value: result.data };
      },
    });
  }

  getById(id: string): ExamSchedule | undefined {
    return this.list().find((schedule) => schedule.id === id);
  }

  listByExamId(examId: string): ExamSchedule[] {
    return this.list().filter((schedule) => schedule.examId === examId);
  }

  save(schedule: ExamSchedule): void {
    const valid = assertExamSchedule(schedule);
    const all = this.list().filter((item) => item.id !== valid.id);
    all.push(valid);
    writeStorageJson("local", STORAGE_KEYS.schedules, all);
  }

  deactivate(id: string): void {
    const all = this.list().map((schedule) =>
      schedule.id === id
        ? { ...schedule, active: false, updatedAt: Date.now() }
        : schedule,
    );
    writeStorageJson("local", STORAGE_KEYS.schedules, all);
  }

  delete(id: string): void {
    writeStorageJson(
      "local",
      STORAGE_KEYS.schedules,
      this.list().filter((schedule) => schedule.id !== id),
    );
  }
}
