import type { AttemptRepository } from "@/repositories/interfaces/attempt-repository";
import type { AuditRepository } from "@/repositories/interfaces/audit-repository";
import type { BatchRepository } from "@/repositories/interfaces/batch-repository";
import type { ExamRepository } from "@/repositories/interfaces/exam-repository";
import type { QuestionRepository } from "@/repositories/interfaces/question-repository";
import type { ScheduleRepository } from "@/repositories/interfaces/schedule-repository";
import type { StudentRepository } from "@/repositories/interfaces/student-repository";
import type { CbtAttemptRepository } from "@/repositories/interfaces/cbt-attempt-repository";
import type { CbtTestRepository } from "@/repositories/interfaces/cbt-test-repository";
import type { TestSessionRepository } from "@/repositories/interfaces/test-session-repository";
import { logValidationFailure } from "@/lib/logging/runtime-logger";

const QUESTION_METHODS = [
  "list",
  "getById",
  "saveAll",
  "upsert",
  "delete",
] as const satisfies readonly (keyof QuestionRepository)[];

const EXAM_METHODS = [
  "list",
  "getById",
  "save",
  "delete",
] as const satisfies readonly (keyof ExamRepository)[];

const STUDENT_METHODS = [
  "getSession",
  "saveSession",
  "clearSession",
  "list",
  "getById",
  "getByRollNumber",
  "save",
  "deactivate",
  "delete",
] as const satisfies readonly (keyof StudentRepository)[];

const BATCH_METHODS = [
  "list",
  "getById",
  "save",
  "archive",
  "delete",
] as const satisfies readonly (keyof BatchRepository)[];

const SCHEDULE_METHODS = [
  "list",
  "getById",
  "listByExamId",
  "save",
  "deactivate",
  "delete",
] as const satisfies readonly (keyof ScheduleRepository)[];

const ATTEMPT_METHODS = [
  "load",
  "save",
  "clear",
] as const satisfies readonly (keyof AttemptRepository)[];

const AUDIT_METHODS = [
  "append",
  "list",
  "clear",
] as const satisfies readonly (keyof AuditRepository)[];

const CBT_TEST_METHODS = [
  "list",
  "getById",
  "save",
  "delete",
] as const satisfies readonly (keyof CbtTestRepository)[];

const CBT_ATTEMPT_METHODS = [
  "save",
  "listByTestId",
  "listByStudentId",
  "getLatest",
] as const satisfies readonly (keyof CbtAttemptRepository)[];

const TEST_SESSION_METHODS = [
  "list",
  "getById",
  "getActive",
  "save",
  "delete",
] as const satisfies readonly (keyof TestSessionRepository)[];

function hasMethods(
  repo: object,
  methods: readonly string[],
): string[] {
  const missing: string[] = [];
  for (const method of methods) {
    if (typeof (repo as Record<string, unknown>)[method] !== "function") {
      missing.push(method);
    }
  }
  return missing;
}

export interface ContractCheckResult {
  ok: boolean;
  issues: string[];
}

export function validateRepositoryContracts(bundle: {
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
}): ContractCheckResult {
  const issues: string[] = [];

  const checks: [string, object, readonly string[]][] = [
    ["QuestionRepository", bundle.questions, QUESTION_METHODS],
    ["ExamRepository", bundle.exams, EXAM_METHODS],
    ["StudentRepository", bundle.students, STUDENT_METHODS],
    ["BatchRepository", bundle.batches, BATCH_METHODS],
    ["ScheduleRepository", bundle.schedules, SCHEDULE_METHODS],
    ["AttemptRepository", bundle.attempts, ATTEMPT_METHODS],
    ["AuditRepository", bundle.audit, AUDIT_METHODS],
    ["CbtTestRepository", bundle.cbtTests, CBT_TEST_METHODS],
    ["CbtAttemptRepository", bundle.cbtAttempts, CBT_ATTEMPT_METHODS],
    ["TestSessionRepository", bundle.testSessions, TEST_SESSION_METHODS],
  ];

  for (const [name, repo, methods] of checks) {
    const missing = hasMethods(repo, methods);
    if (missing.length > 0) {
      issues.push(`${name} missing: ${missing.join(", ")}`);
    }
  }

  if (issues.length > 0) {
    logValidationFailure("repository-contract", issues.join("; "));
  }

  return { ok: issues.length === 0, issues };
}
