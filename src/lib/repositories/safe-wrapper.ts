import { toRepositoryError } from "@/lib/errors/repository-error";
import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import { getScopedQuery, guardTenantWrite } from "@/lib/tenant-scope";
import { getClientWorkspaceSession } from "@/lib/workspace-session";
import type { AttemptRepository } from "@/repositories/interfaces/attempt-repository";
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
import type { CbtAttemptRepository } from "@/repositories/interfaces/cbt-attempt-repository";
import type { CbtTestRepository } from "@/repositories/interfaces/cbt-test-repository";
import type { TestSessionRepository } from "@/repositories/interfaces/test-session-repository";
import type { UserRole } from "@/types/access-control";
import type { CBTTest, CbtFinalAttempt } from "@/types/cbt";
import type { TestSession } from "@/types/test-session";

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

export function wrapAttemptRepository(
  inner: AttemptRepository,
): AttemptRepository {
  const name = "attempts";
  return {
    load: (examId, roll) =>
      runSafe(name, "load", null, () => inner.load(examId, roll)),
    save: (attempt) => runSafeVoid(name, "save", () => inner.save(attempt)),
    clear: (examId, roll) =>
      runSafeVoid(name, "clear", () => inner.clear(examId, roll)),
  };
}

function canManageCbtTests(role: UserRole | undefined): boolean {
  if (!role) return false;
  return role === "institute";
}

export function wrapCbtTestRepository(inner: CbtTestRepository): CbtTestRepository {
  const name = "cbtTests";
  return {
    list: () =>
      runSafe(name, "list", [] as CBTTest[], () =>
        getScopedQuery(inner.list(), getClientWorkspaceSession()),
      ),
    getById: (id) =>
      runSafe(name, "getById", undefined, () =>
        getScopedQuery(inner.list(), getClientWorkspaceSession()).find((t) => t.id === id),
      ),
    save: (test) =>
      runSafeVoid(name, "save", () => {
        const session = getClientWorkspaceSession();
        if (!canManageCbtTests(session?.role)) {
          throw new Error("Only institute staff can save CBT tests.");
        }
        inner.save(guardTenantWrite(test, session));
      }),
    delete: (id) =>
      runSafeVoid(name, "delete", () => {
        const session = getClientWorkspaceSession();
        if (!canManageCbtTests(session?.role)) return;
        const scoped = getScopedQuery(inner.list(), session).find((t) => t.id === id);
        if (scoped) inner.delete(id);
      }),
  };
}

export function wrapCbtAttemptRepository(
  inner: CbtAttemptRepository,
): CbtAttemptRepository {
  const name = "cbtAttempts";
  return {
    save: (record) =>
      runSafeVoid(name, "save", () => {
        const session = getClientWorkspaceSession();
        if (!session) throw new Error("Unauthenticated");
        if (session.role === "student") {
          if (record.attempt.studentId !== session.userId) {
            throw new Error("Cross-student attempt write blocked.");
          }
          if (record.attempt.instituteId !== session.instituteId) {
            throw new Error("Tenant mismatch on attempt.");
          }
        } else {
          throw new Error("Only students may submit CBT attempts.");
        }
        inner.save(record);
      }),
    listByTestId: (testId) =>
      runSafe(name, "listByTestId", [] as CbtFinalAttempt[], () => {
        const session = getClientWorkspaceSession();
        const rows = inner.listByTestId(testId);
        if (!session) return [];
        if (session.role === "platform_admin") return rows;
        if (session.role === "student") return [];
        return rows.filter((r) => r.attempt.instituteId === session.instituteId);
      }),
    listByStudentId: (studentId) =>
      runSafe(name, "listByStudentId", [] as CbtFinalAttempt[], () => {
        const session = getClientWorkspaceSession();
        const rows = inner.listByStudentId(studentId);
        if (!session) return [];
        if (session.role === "platform_admin") return rows;
        if (session.role === "student") {
          if (studentId !== session.userId) return [];
          return rows.filter((r) => r.attempt.studentId === session.userId);
        }
        return rows.filter((r) => r.attempt.instituteId === session.instituteId);
      }),
    getLatest: (testId, studentId) =>
      runSafe(name, "getLatest", undefined, () => {
        const session = getClientWorkspaceSession();
        const row = inner.getLatest(testId, studentId);
        if (!row || !session) return undefined;
        if (session.role === "platform_admin") return row;
        if (session.role === "student") {
          if (studentId !== session.userId) return undefined;
          if (row.attempt.instituteId !== session.instituteId) return undefined;
          return row;
        }
        if (row.attempt.instituteId !== session.instituteId) return undefined;
        return row;
      }),
  };
}

export function wrapTestSessionRepository(
  inner: TestSessionRepository,
): TestSessionRepository {
  const name = "testSessions";
  const scopedList = () => {
    const ws = getClientWorkspaceSession();
    const rows = inner.list();
    if (!ws) return [];
    if (ws.role === "platform_admin") return rows;
    if (ws.role === "student") {
      return rows.filter(
        (r) => r.studentId === ws.userId && r.instituteId === ws.instituteId,
      );
    }
    return rows.filter((r) => r.instituteId === ws.instituteId);
  };
  return {
    list: () => runSafe(name, "list", [] as TestSession[], scopedList),
    getById: (id) =>
      runSafe(name, "getById", undefined, () => scopedList().find((s) => s.id === id)),
    getActive: (testId, studentId) =>
      runSafe(name, "getActive", undefined, () => {
        const ws = getClientWorkspaceSession();
        if (ws?.role === "student" && studentId !== ws.userId) return undefined;
        const row = scopedList().find(
          (s) =>
            s.testId === testId &&
            s.studentId === studentId &&
            s.status === "in_progress",
        );
        return row;
      }),
    save: (session) =>
      runSafeVoid(name, "save", () => {
        const ws = getClientWorkspaceSession();
        if (!ws) throw new Error("Unauthenticated");
        if (ws.role === "student") {
          if (session.studentId !== ws.userId) {
            throw new Error("Cross-student session write blocked.");
          }
          if (session.instituteId !== ws.instituteId) {
            throw new Error("Tenant mismatch on test session.");
          }
        } else if (session.instituteId !== ws.instituteId) {
          throw new Error("Cross-institute session write blocked.");
        }
        inner.save(session);
      }),
    delete: (id) =>
      runSafeVoid(name, "delete", () => {
        const row = scopedList().find((s) => s.id === id);
        if (row) inner.delete(id);
      }),
  };
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
  attempts: AttemptRepository;
  audit: AuditRepository;
  cbtTests: CbtTestRepository;
  cbtAttempts: CbtAttemptRepository;
  testSessions: TestSessionRepository;
}): typeof bundle {
  return {
    questions: wrapQuestionRepository(bundle.questions),
    exams: wrapExamRepository(bundle.exams),
    students: wrapStudentRepository(bundle.students),
    batches: wrapBatchRepository(bundle.batches),
    schedules: wrapScheduleRepository(bundle.schedules),
    attempts: wrapAttemptRepository(bundle.attempts),
    audit: wrapAuditRepository(bundle.audit),
    cbtTests: wrapCbtTestRepository(bundle.cbtTests),
    cbtAttempts: wrapCbtAttemptRepository(bundle.cbtAttempts),
    testSessions: wrapTestSessionRepository(bundle.testSessions),
  };
}
