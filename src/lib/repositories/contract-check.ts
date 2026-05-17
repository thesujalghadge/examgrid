import type { AttemptRepository } from "@/repositories/interfaces/attempt-repository";
import type { ExamRepository } from "@/repositories/interfaces/exam-repository";
import type { QuestionRepository } from "@/repositories/interfaces/question-repository";
import type { StudentRepository } from "@/repositories/interfaces/student-repository";
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
] as const satisfies readonly (keyof StudentRepository)[];

const ATTEMPT_METHODS = [
  "load",
  "save",
  "clear",
] as const satisfies readonly (keyof AttemptRepository)[];

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
  attempts: AttemptRepository;
}): ContractCheckResult {
  const issues: string[] = [];

  const checks: [string, object, readonly string[]][] = [
    ["QuestionRepository", bundle.questions, QUESTION_METHODS],
    ["ExamRepository", bundle.exams, EXAM_METHODS],
    ["StudentRepository", bundle.students, STUDENT_METHODS],
    ["AttemptRepository", bundle.attempts, ATTEMPT_METHODS],
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
