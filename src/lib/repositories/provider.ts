import {
  getRepositoryModeFromEnv,
  type RepositoryMode,
} from "@/config/repository";
import { logRepositoryMode } from "@/lib/logging/runtime-logger";
import { validateRepositoryContracts } from "@/lib/repositories/contract-check";
import { wrapRepositoryBundle } from "@/lib/repositories/safe-wrapper";
import type { AuditRepository } from "@/repositories/interfaces/audit-repository";
import type { BatchRepository } from "@/repositories/interfaces/batch-repository";
import type { ExamRepository } from "@/repositories/interfaces/exam-repository";
import type { QuestionRepository } from "@/repositories/interfaces/question-repository";
import type { ScheduleRepository } from "@/repositories/interfaces/schedule-repository";
import type { StudentRepository } from "@/repositories/interfaces/student-repository";
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
  audit: AuditRepository;
}

function buildBundle(mode: RepositoryMode): RepositoryBundle {
  const inner: RepositoryBundle = {
    mode: "supabase",
    questions: new SupabaseQuestionRepository(),
    exams: new SupabaseExamRepository(),
    students: new SupabaseStudentRepository(),
    batches: new SupabaseBatchRepository(),
    schedules: new SupabaseScheduleRepository(),
    audit: new SupabaseAuditRepository(),
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
  return "supabase"; // Force Supabase mode
}

function logRepositoryModeOnce(mode: RepositoryMode): void {
  if (modeLogged) return;
  modeLogged = true;
  logRepositoryMode("supabase", "Supabase strictly enforced.");
}

/** Singleton repository bundle selected by NEXT_PUBLIC_REPOSITORY_MODE. */
export function getRepositories(): RepositoryBundle {
  if (!activeBundle) {
    activeBundle = buildBundle("supabase");
    logRepositoryModeOnce("supabase");
  }
  return activeBundle;
}

/** For admin/status APIs — does not trigger client-only logging side effects. */
export function describeRepositoryMode(): {
  mode: RepositoryMode;
  label: string;
  persistence: string;
} {
  return {
    mode: "supabase",
    label: "Supabase mode",
    persistence: "Question bank and exam catalog persist in Supabase.",
  };
}
