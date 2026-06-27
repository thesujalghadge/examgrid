import { toRepositoryError } from "@/lib/errors/repository-error";
import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import { getScopedQuery, guardTenantWrite } from "@/lib/tenant-scope";
import { getClientWorkspaceSession } from "@/lib/workspace-session";
import type { AuditRepository } from "@/repositories/interfaces/audit-repository";
import type { BatchRepository } from "@/repositories/interfaces/batch-repository";
import type { ExamRepository } from "@/repositories/interfaces/exam-repository";
import type { QuestionRepository } from "@/repositories/interfaces/question-repository";
import type { ScheduleRepository } from "@/repositories/interfaces/schedule-repository";
import type { StudentRepository } from "@/repositories/interfaces/student-repository";
import type { BankQuestion } from "@/types/question-bank";
import type { ExamDefinition } from "@/types/exam";
import type { Batch, ExamSchedule, InstituteStudent } from "@/types/institute-ops";
import type { AuditLogEntry } from "@/types/audit";

function runSafe<T>(
  repository: string,
  operation: string,
  fallback: T,
  fn: () => T,
): T {
  try {
    return fn();
  } catch (error) {
    const repoError = toRepositoryError(error, repository, operation);
    logRepositoryFailure(`${repository}.${operation}`, repoError);
    return fallback;
  }
}

function runSafeVoid(
  repository: string,
  operation: string,
  fn: () => void,
): void {
  try {
    fn();
  } catch (error) {
    const repoError = toRepositoryError(error, repository, operation);
    logRepositoryFailure(`${repository}.${operation}`, repoError);
  }
}

function withRepositoryLifecycle<T extends object>(wrapped: T, inner: object): T {
  const extras: Record<string, unknown> = {};
  const maybe = inner as Record<string, unknown>;
  if (typeof maybe.refreshFromRemote === "function") {
    extras.refreshFromRemote = maybe.refreshFromRemote.bind(inner);
  }
  if (typeof maybe.whenIdle === "function") {
    extras.whenIdle = maybe.whenIdle.bind(inner);
  }
  if ("isHydrated" in maybe) {
    Object.defineProperty(extras, "isHydrated", {
      enumerable: false,
      get: () => (inner as { isHydrated?: boolean }).isHydrated,
    });
  }
  return Object.assign(wrapped, extras);
}

export function wrapQuestionRepository(
  inner: QuestionRepository,
): QuestionRepository {
  const name = "questions";
  return withRepositoryLifecycle({
    list: () => runSafe(name, "list", [] as BankQuestion[], () => inner.list()),
    getById: (id) =>
      runSafe(name, "getById", undefined, () => inner.getById(id)),
    saveAll: (questions) =>
      runSafeVoid(name, "saveAll", () => inner.saveAll(questions)),
    upsert: (question) =>
      runSafeVoid(name, "upsert", () => inner.upsert(question)),
    delete: (id) => runSafeVoid(name, "delete", () => inner.delete(id)),
  }, inner);
}

export function wrapExamRepository(inner: ExamRepository): ExamRepository {
  const name = "exams";
  return withRepositoryLifecycle({
    list: () => runSafe(name, "list", [] as ExamDefinition[], () => inner.list()),
    getById: (id) =>
      runSafe(name, "getById", undefined, () => inner.getById(id)),
    save: (exam) => runSafeVoid(name, "save", () => inner.save(exam)),
    delete: (id) => runSafeVoid(name, "delete", () => inner.delete(id)),
  }, inner);
}

export function wrapStudentRepository(
  inner: StudentRepository,
): StudentRepository {
  const name = "students";
  return withRepositoryLifecycle({
    getSession: () =>
      runSafe(name, "getSession", null, () => inner.getSession()),
    saveSession: (student) =>
      runSafeVoid(name, "saveSession", () => inner.saveSession(student)),
    clearSession: () => runSafeVoid(name, "clearSession", () => inner.clearSession()),
    list: () =>
      runSafe(name, "list", [] as InstituteStudent[], () =>
        getScopedQuery(inner.list(), getClientWorkspaceSession()),
      ),
    getById: (id) =>
      runSafe(name, "getById", undefined, () =>
        getScopedQuery(inner.list(), getClientWorkspaceSession()).find((row) => row.id === id),
      ),
    getByRollNumber: (rollNumber) =>
      runSafe(name, "getByRollNumber", undefined, () =>
        getScopedQuery(inner.list(), getClientWorkspaceSession()).find(
          (row) => row.rollNumber.trim().toLowerCase() === rollNumber.trim().toLowerCase(),
        ),
      ),
    save: (student) =>
      runSafeVoid(name, "save", () =>
        inner.save(guardTenantWrite(student, getClientWorkspaceSession())),
      ),
    deactivate: (id) =>
      runSafeVoid(name, "deactivate", () => {
        const scoped = getScopedQuery(inner.list(), getClientWorkspaceSession()).find(
          (row) => row.id === id,
        );
        if (scoped) inner.deactivate(id);
      }),
    delete: (id) =>
      runSafeVoid(name, "delete", () => {
        const scoped = getScopedQuery(inner.list(), getClientWorkspaceSession()).find(
          (row) => row.id === id,
        );
        if (scoped) inner.delete(id);
      }),
  }, inner);
}

export function wrapBatchRepository(inner: BatchRepository): BatchRepository {
  const name = "batches";
  return withRepositoryLifecycle({
    list: () =>
      runSafe(name, "list", [] as Batch[], () =>
        getScopedQuery(inner.list(), getClientWorkspaceSession()),
      ),
    getById: (id) =>
      runSafe(name, "getById", undefined, () =>
        getScopedQuery(inner.list(), getClientWorkspaceSession()).find((row) => row.id === id),
      ),
    save: (batch) =>
      runSafeVoid(name, "save", () =>
        inner.save(guardTenantWrite(batch, getClientWorkspaceSession())),
      ),
    archive: (id) =>
      runSafeVoid(name, "archive", () => {
        const scoped = getScopedQuery(inner.list(), getClientWorkspaceSession()).find(
          (row) => row.id === id,
        );
        if (scoped) inner.archive(id);
      }),
    delete: (id) =>
      runSafeVoid(name, "delete", () => {
        const scoped = getScopedQuery(inner.list(), getClientWorkspaceSession()).find(
          (row) => row.id === id,
        );
        if (scoped) inner.delete(id);
      }),
  }, inner);
}

export function wrapScheduleRepository(
  inner: ScheduleRepository,
): ScheduleRepository {
  const name = "schedules";
  return withRepositoryLifecycle({
    list: () =>
      runSafe(name, "list", [] as ExamSchedule[], () =>
        getScopedQuery(inner.list(), getClientWorkspaceSession()),
      ),
    getById: (id) =>
      runSafe(name, "getById", undefined, () =>
        getScopedQuery(inner.list(), getClientWorkspaceSession()).find((row) => row.id === id),
      ),
    listByExamId: (examId) =>
      runSafe(name, "listByExamId", [] as ExamSchedule[], () =>
        getScopedQuery(inner.listByExamId(examId), getClientWorkspaceSession()),
      ),
    save: (schedule) =>
      runSafeVoid(name, "save", () =>
        inner.save(guardTenantWrite(schedule, getClientWorkspaceSession())),
      ),
    deactivate: (id) =>
      runSafeVoid(name, "deactivate", () => {
        const scoped = getScopedQuery(inner.list(), getClientWorkspaceSession()).find(
          (row) => row.id === id,
        );
        if (scoped) inner.deactivate(id);
      }),
    delete: (id) =>
      runSafeVoid(name, "delete", () => {
        const scoped = getScopedQuery(inner.list(), getClientWorkspaceSession()).find(
          (row) => row.id === id,
        );
        if (scoped) inner.delete(id);
      }),
  }, inner);
}

export function wrapAuditRepository(inner: AuditRepository): AuditRepository {
  const name = "audit";
  return withRepositoryLifecycle({
    append: (entry) => runSafeVoid(name, "append", () => inner.append(entry)),
    list: (query) =>
      runSafe(
        name,
        "list",
        { rows: [] as AuditLogEntry[], total: 0, page: 1, pageSize: 25 },
        () => inner.list(query),
      ),
    clear: () => runSafeVoid(name, "clear", () => inner.clear()),
  }, inner);
}

export function wrapRepositoryBundle(bundle: {
  questions: QuestionRepository;
  exams: ExamRepository;
  students: StudentRepository;
  batches: BatchRepository;
  schedules: ScheduleRepository;
  audit: AuditRepository;
}): typeof bundle {
  return {
    questions: wrapQuestionRepository(bundle.questions),
    exams: wrapExamRepository(bundle.exams),
    students: wrapStudentRepository(bundle.students),
    batches: wrapBatchRepository(bundle.batches),
    schedules: wrapScheduleRepository(bundle.schedules),
    audit: wrapAuditRepository(bundle.audit),
  };
}
