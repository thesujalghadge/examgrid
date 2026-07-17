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

  const startTime = performance.now();

  try {
    // Execute sequentially to avoid connection pool exhaustion / 'Failed to fetch' network errors
    // We specifically omit 'questions' here to avoid massive startup cost (it will be lazy loaded).
    await exams.refreshFromRemote();
    await students.refreshFromRemote();
    await batches.refreshFromRemote();
    await schedules.refreshFromRemote();
    
    const eList = exams.list();
    const sList = students.list();
    const bList = batches.list();
    const scList = schedules.list();

    const eCount = eList.length;
    const sCount = sList.length;
    const bCount = bList.length;
    const scheduleCount = scList.length;
    
    const endTime = performance.now();
    const totalTimeMs = Math.round(endTime - startTime);

    if (process.env.NODE_ENV === "development") {
      const approxBytes = JSON.stringify(eList).length + JSON.stringify(sList).length + JSON.stringify(bList).length + JSON.stringify(scList).length;
      const approxKb = (approxBytes / 1024).toFixed(1);
      
      console.log(`[Hydration Metrics]
  - Repositories: exams, students, batches, schedules
  - Rows Loaded: ${eCount + sCount + bCount + scheduleCount} (${eCount} exams, ${sCount} students, ${bCount} batches, ${scheduleCount} schedules)
  - Payload Size (approx): ${approxKb} KB
  - Hydration Time: ${totalTimeMs}ms`);
    }

    logRepositoryMode(
      "supabase",
      `hydrated ${eCount} exams, ${sCount} students, ${bCount} batches, ${scheduleCount} schedules`,
    );
    return {
      ok: true,
      questionsCount: questions.isHydrated ? questions.list().length : 0,
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

export async function hydrateSupabaseQuestions(): Promise<void> {
  if (getRepositoryMode() !== "supabase") return;
  const bundle = getRepositories();
  const questions = bundle.questions as SupabaseQuestionRepository;
  if (!questions.isHydrated) {
    await questions.refreshFromRemote();
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
