import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import { assertInstituteUuid } from "@/config/institute";
import { assertPersistedUuid } from "@/lib/identity-boundary";
import { getClientWorkspaceSession } from "@/lib/workspace-session";
import { assertExamSchedule } from "@/lib/validation/institute-ops-schema";
import type { ScheduleRepository } from "@/repositories/interfaces/schedule-repository";
import {
  rowToSchedule,
  scheduleToRow,
} from "@/repositories/supabase/mappers/institute-ops-mapper";
import {
  requireSupabaseClient,
  throwIfSupabaseError,
} from "@/repositories/supabase/supabase-repo-utils";
import type {
  ExamScheduleBatchRow,
  ExamScheduleRow,
} from "@/repositories/supabase/types";
import type { ExamSchedule } from "@/types/institute-ops";

export class SupabaseScheduleRepository implements ScheduleRepository {
  private cache: ExamSchedule[] = [];
  private hydrated = false;
  private refreshPromise: Promise<void> | null = null;
  private persistChain: Promise<void> = Promise.resolve();

  get isHydrated(): boolean {
    return this.hydrated;
  }

  list(): ExamSchedule[] {
    return [...this.cache];
  }

  getById(id: string): ExamSchedule | undefined {
    return this.cache.find((schedule) => schedule.id === id);
  }

  listByExamId(examId: string): ExamSchedule[] {
    return this.cache.filter((schedule) => schedule.examId === examId);
  }

  save(schedule: ExamSchedule): void {
    const valid = assertExamSchedule(schedule);
    const idx = this.cache.findIndex((item) => item.id === valid.id);
    if (idx >= 0) this.cache[idx] = valid;
    else this.cache.push(valid);
    this.enqueuePersist(() => this.persistOne(valid));
  }

  deactivate(id: string): void {
    const existing = this.getById(id);
    if (!existing) return;
    this.save({ ...existing, active: false, updatedAt: Date.now() });
  }

  delete(id: string): void {
    this.cache = this.cache.filter((schedule) => schedule.id !== id);
    this.enqueuePersist(() => this.removeOne(id));
  }

  async whenIdle(): Promise<void> {
    await this.persistChain;
  }

  async refreshFromRemote(): Promise<void> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.doRefresh();
    try {
      await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  private enqueuePersist(task: () => Promise<void>): void {
    this.persistChain = this.persistChain.then(task).catch((error) => {
      logRepositoryFailure("SupabaseScheduleRepository.persistChain", error);
    });
  }

  private async doRefresh(): Promise<void> {
    const session = getClientWorkspaceSession();
    if (!session?.instituteId) {
      this.cache = [];
      this.hydrated = true;
      return;
    }

    try {
      assertInstituteUuid(session.instituteId, "session.instituteId");

      const client = requireSupabaseClient("exam_schedules.list");
      const { data: schedules, error: scheduleError } = await client
        .from("exam_schedules")
        .select("*")
        .eq("institute_id", session.instituteId)
        .order("start_at", { ascending: false });
      throwIfSupabaseError(scheduleError, "exam_schedules", "list");

      const rows = (schedules ?? []) as ExamScheduleRow[];
      if (rows.length === 0) {
        this.cache = [];
        this.hydrated = true;
        return;
      }

      const { data: links, error: linkError } = await client
        .from("exam_schedule_batches")
        .select("*")
        .in(
          "schedule_id",
          rows.map((row) => row.id),
        );
      throwIfSupabaseError(linkError, "exam_schedule_batches", "list");

      const linkRows = (links ?? []) as ExamScheduleBatchRow[];
      this.cache = rows.map((row) =>
        rowToSchedule(
          row,
          linkRows
            .filter((link) => link.schedule_id === row.id)
            .map((link) => link.batch_id),
        ),
      );
      this.hydrated = true;
    } catch (error) {
      logRepositoryFailure("SupabaseScheduleRepository.refresh", error);
      this.cache = [];
      this.hydrated = true;
    }
  }

  private async persistOne(schedule: ExamSchedule): Promise<void> {
    const client = requireSupabaseClient("exam_schedules.upsert");
    
    const realExamId = assertPersistedUuid(schedule.examId, "exam_schedules.exam_id");
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realExamId);
    if (!isUuid) {
      throw new Error(`Invariant violation: schedule attempted with non-uuid examId=${realExamId}`);
    }

    const row = scheduleToRow(schedule);
    row.exam_id = realExamId;

    const { error } = await client
      .from("exam_schedules")
      .upsert(row, { onConflict: "id" });
    throwIfSupabaseError(error, "exam_schedules", "upsert");

    const { error: deleteLinksError } = await client
      .from("exam_schedule_batches")
      .delete()
      .eq("schedule_id", schedule.id);
    throwIfSupabaseError(
      deleteLinksError,
      "exam_schedule_batches",
      "delete",
    );

    if (schedule.batchIds.length > 0) {
      const { error: linkError } = await client
        .from("exam_schedule_batches")
        .insert(
          schedule.batchIds.map((batchId) => ({
            schedule_id: schedule.id,
            batch_id: batchId,
            institute_id: schedule.instituteId,
          })),
        );
      throwIfSupabaseError(linkError, "exam_schedule_batches", "insert");

      // Trigger syllabus mapping asynchronously for each assigned batch
      try {
        for (const batchId of schedule.batchIds) {
          fetch("/api/internal/trigger-syllabus-mapping", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              batchId,
              instituteId: schedule.instituteId,
            }),
          }).catch(console.error);
        }
      } catch (err) {
        console.error("Failed to trigger mapping service", err);
      }
    }
  }

  private async removeOne(id: string): Promise<void> {
    const client = requireSupabaseClient("exam_schedules.delete");
    const { error } = await client.from("exam_schedules").delete().eq("id", id);
    throwIfSupabaseError(error, "exam_schedules", "delete");
  }
}

