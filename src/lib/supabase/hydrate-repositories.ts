import {
  getRepositories,
  getRepositoryMode,
} from "@/lib/repositories/provider";
import { SupabaseExamRepository } from "@/repositories/supabase/supabase-exam-repository";
import { SupabaseQuestionRepository } from "@/repositories/supabase/supabase-question-repository";
import { logRepositoryMode } from "@/lib/logging/runtime-logger";

export interface HydrateResult {
  ok: boolean;
  questionsCount: number;
  examsCount: number;
  error?: string;
}

export async function hydrateSupabaseRepositories(): Promise<HydrateResult> {
  if (getRepositoryMode() !== "supabase") {
    return { ok: true, questionsCount: 0, examsCount: 0 };
  }

  const bundle = getRepositories();
  const questions = bundle.questions as SupabaseQuestionRepository;
  const exams = bundle.exams as SupabaseExamRepository;

  try {
    await Promise.all([
      questions.refreshFromRemote(),
      exams.refreshFromRemote(),
    ]);
    const qCount = questions.list().length;
    const eCount = exams.list().length;
    logRepositoryMode(
      "supabase",
      `hydrated ${qCount} questions, ${eCount} exams`,
    );
    return { ok: true, questionsCount: qCount, examsCount: eCount };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Hydration failed";
    return {
      ok: false,
      questionsCount: 0,
      examsCount: 0,
      error: message,
    };
  }
}

export function isSupabaseRepositoriesHydrated(): boolean {
  if (getRepositoryMode() !== "supabase") return true;
  const bundle = getRepositories();
  const questions = bundle.questions as SupabaseQuestionRepository;
  const exams = bundle.exams as SupabaseExamRepository;
  return questions.isHydrated && exams.isHydrated;
}
