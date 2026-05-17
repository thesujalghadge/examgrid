import { getRepositoryMode } from "@/lib/repositories/provider";
import { getRepositories } from "@/lib/repositories/provider";
import { SupabaseExamRepository } from "@/repositories/supabase/supabase-exam-repository";
import { SupabaseQuestionRepository } from "@/repositories/supabase/supabase-question-repository";

/** Flush pending Supabase writes before navigation (admin flows). */
export async function awaitRepositoryPersist(): Promise<void> {
  if (getRepositoryMode() !== "supabase") return;
  const { questions, exams } = getRepositories();
  await Promise.all([
    (questions as SupabaseQuestionRepository).whenIdle(),
    (exams as SupabaseExamRepository).whenIdle(),
  ]);
}
