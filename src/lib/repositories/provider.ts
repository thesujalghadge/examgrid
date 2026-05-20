import {
  getRepositoryModeFromEnv,
  type RepositoryMode,
} from "@/config/repository";
import { logRepositoryMode } from "@/lib/logging/runtime-logger";
import { validateRepositoryContracts } from "@/lib/repositories/contract-check";
import { wrapRepositoryBundle } from "@/lib/repositories/safe-wrapper";
import type { AttemptRepository } from "@/repositories/interfaces/attempt-repository";
import type { AuditRepository } from "@/repositories/interfaces/audit-repository";
import type { BatchRepository } from "@/repositories/interfaces/batch-repository";
import type { ExamRepository } from "@/repositories/interfaces/exam-repository";
import type { QuestionRepository } from "@/repositories/interfaces/question-repository";
import type { ScheduleRepository } from "@/repositories/interfaces/schedule-repository";
import type { StudentRepository } from "@/repositories/interfaces/student-repository";
import type { CbtAttemptRepository } from "@/repositories/interfaces/cbt-attempt-repository";
import type { CbtTestRepository } from "@/repositories/interfaces/cbt-test-repository";
import { LocalAttemptRepository } from "@/repositories/local/local-attempt-repository";
import { LocalCbtAttemptRepository } from "@/repositories/local/local-cbt-attempt-repository";
import { LocalCbtTestRepository } from "@/repositories/local/local-cbt-test-repository";
import { LocalTestSessionRepository } from "@/repositories/local/local-test-session-repository";
import type { TestSessionRepository } from "@/repositories/interfaces/test-session-repository";
import { LocalAuditRepository } from "@/repositories/local/local-audit-repository";
import { LocalBatchRepository } from "@/repositories/local/local-batch-repository";
import { LocalExamRepository } from "@/repositories/local/local-exam-repository";
import { LocalQuestionRepository } from "@/repositories/local/local-question-repository";
import { LocalScheduleRepository } from "@/repositories/local/local-schedule-repository";
import { LocalStudentRepository } from "@/repositories/local/local-student-repository";
import { SupabaseBatchRepository } from "@/repositories/supabase/supabase-batch-repository";
import { SupabaseAuditRepository } from "@/repositories/supabase/supabase-audit-repository";
import { SupabaseExamRepository } from "@/repositories/supabase/supabase-exam-repository";
import { SupabaseQuestionRepository } from "@/repositories/supabase/supabase-question-repository";
import { SupabaseScheduleRepository } from "@/repositories/supabase/supabase-schedule-repository";
import { SupabaseStudentRepository } from "@/repositories/supabase/supabase-student-repository";

export interface RepositoryBundle {
  mode: RepositoryMode;
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
}

function buildBundle(mode: RepositoryMode): RepositoryBundle {
  const inner: RepositoryBundle =
    mode === "supabase"
      ? {
          mode: "supabase",
          questions: new SupabaseQuestionRepository(),
          exams: new SupabaseExamRepository(),
          students: new SupabaseStudentRepository(),
          batches: new SupabaseBatchRepository(),
          schedules: new SupabaseScheduleRepository(),
          attempts: new LocalAttemptRepository(),
          audit: new SupabaseAuditRepository(),
          cbtTests: new LocalCbtTestRepository(),
          cbtAttempts: new LocalCbtAttemptRepository(),
          testSessions: new LocalTestSessionRepository(),
        }
      : {
          mode: "local",
          questions: new LocalQuestionRepository(),
          exams: new LocalExamRepository(),
          students: new LocalStudentRepository(),
          batches: new LocalBatchRepository(),
          schedules: new LocalScheduleRepository(),
          attempts: new LocalAttemptRepository(),
          audit: new LocalAuditRepository(),
          cbtTests: new LocalCbtTestRepository(),
          cbtAttempts: new LocalCbtAttemptRepository(),
          testSessions: new LocalTestSessionRepository(),
        };

  const safe = wrapRepositoryBundle(inner);
  const bundle: RepositoryBundle = { mode: inner.mode, ...safe };

  if (process.env.NODE_ENV !== "production") {
    validateRepositoryContracts(bundle);
  }

  return bundle;
}

let activeBundle: RepositoryBundle | null = null;
let modeLogged = false;

export function getRepositoryMode(): RepositoryMode {
  return getRepositoryModeFromEnv();
}

function logRepositoryModeOnce(mode: RepositoryMode): void {
  if (modeLogged) return;
  modeLogged = true;
  const label =
    mode === "local"
      ? "localStorage (browser)"
      : "Supabase operations/questions/exams + local attempts";
  logRepositoryMode(mode, label);
}

/** Singleton repository bundle selected by NEXT_PUBLIC_REPOSITORY_MODE. */
export function getRepositories(): RepositoryBundle {
  const mode = getRepositoryMode();
  if (!activeBundle || activeBundle.mode !== mode) {
    activeBundle = buildBundle(mode);
    logRepositoryModeOnce(mode);
  }
  return activeBundle;
}

/** For admin/status APIs — does not trigger client-only logging side effects. */
export function describeRepositoryMode(): {
  mode: RepositoryMode;
  label: string;
  persistence: string;
} {
  const mode = getRepositoryMode();
  if (mode === "supabase") {
    return {
      mode,
      label: "Supabase mode",
      persistence:
        "Question bank and exam catalog persist in Supabase. Exam attempts and candidate session remain in browser localStorage.",
    };
  }
  return {
    mode,
    label: "localStorage mode",
    persistence:
      "Question bank, exam catalog, student session, and attempts use browser storage.",
  };
}
