import {
  getRepositories,
  getRepositoryMode,
} from "@/lib/repositories/provider";
import { SupabaseExamRepository } from "@/repositories/supabase/supabase-exam-repository";
import { SupabaseQuestionRepository } from "@/repositories/supabase/supabase-question-repository";
import { SupabaseStudentRepository } from "@/repositories/supabase/supabase-student-repository";
import { SupabaseBatchRepository } from "@/repositories/supabase/supabase-batch-repository";
import { SupabaseScheduleRepository } from "@/repositories/supabase/supabase-schedule-repository";
import { logRepositoryMode } from "@/lib/logging/runtime-logger";

export interface HydrateResult {
  ok: boolean;
  questionsCount: number;
  examsCount: number;
  studentsCount: number;
  batchesCount: number;
  schedulesCount: number;
  error?: string;
}

export async function hydrateSupabaseRepositories(): Promise<HydrateResult> {
  if (getRepositoryMode() !== "supabase") {
    return {
      ok: true,
      questionsCount: 0,
      examsCount: 0,
      studentsCount: 0,
      batchesCount: 0,
      schedulesCount: 0,
    };
  }

  const bundle = getRepositories();
  const questions = bundle.questions as SupabaseQuestionRepository;
  const exams = bundle.exams as SupabaseExamRepository;
  const students = bundle.students as SupabaseStudentRepository;
  const batches = bundle.batches as SupabaseBatchRepository;
  const schedules = bundle.schedules as SupabaseScheduleRepository;

  try {
    await Promise.all([
      questions.refreshFromRemote(),
      exams.refreshFromRemote(),
      students.refreshFromRemote(),
      batches.refreshFromRemote(),
      schedules.refreshFromRemote(),
    ]);
    const qCount = questions.list().length;
    const eCount = exams.list().length;
    const sCount = students.list().length;
    const bCount = batches.list().length;
    const scheduleCount = schedules.list().length;
    logRepositoryMode(
      "supabase",
      `hydrated ${qCount} questions, ${eCount} exams, ${sCount} students, ${bCount} batches, ${scheduleCount} schedules`,
    );
    return {
      ok: true,
      questionsCount: qCount,
      examsCount: eCount,
      studentsCount: sCount,
      batchesCount: bCount,
      schedulesCount: scheduleCount,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Hydration failed";
    return {
      ok: false,
      questionsCount: 0,
      examsCount: 0,
      studentsCount: 0,
      batchesCount: 0,
      schedulesCount: 0,
      error: message,
    };
  }
}

export function isSupabaseRepositoriesHydrated(): boolean {
  if (getRepositoryMode() !== "supabase") return true;
  const bundle = getRepositories();
  const questions = bundle.questions as SupabaseQuestionRepository;
  const exams = bundle.exams as SupabaseExamRepository;
  const students = bundle.students as SupabaseStudentRepository;
  const batches = bundle.batches as SupabaseBatchRepository;
  const schedules = bundle.schedules as SupabaseScheduleRepository;
  return (
    questions.isHydrated &&
    exams.isHydrated &&
    students.isHydrated &&
    batches.isHydrated &&
    schedules.isHydrated
  );
}
