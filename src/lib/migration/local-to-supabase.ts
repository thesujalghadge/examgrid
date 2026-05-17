import { DEFAULT_INSTITUTE_ID } from "@/config/institute";
import { hydrateSupabaseRepositories } from "@/lib/supabase/hydrate-repositories";
import { getRepositoryMode } from "@/lib/repositories/provider";
import { LocalExamRepository } from "@/repositories/local/local-exam-repository";
import { LocalQuestionRepository } from "@/repositories/local/local-question-repository";
import { SupabaseExamRepository } from "@/repositories/supabase/supabase-exam-repository";
import { SupabaseQuestionRepository } from "@/repositories/supabase/supabase-question-repository";
import { requireSupabaseClient } from "@/repositories/supabase/supabase-repo-utils";
import { logPersistenceEvent } from "@/lib/logging/runtime-logger";

export interface MigrationResult {
  success: boolean;
  questionsMigrated: number;
  examsMigrated: number;
  errors: string[];
}

/**
 * Copies question bank + exam catalog from localStorage into Supabase.
 * Does not touch attempts or student session.
 */
export async function migrateLocalToSupabase(): Promise<MigrationResult> {
  const errors: string[] = [];
  const localQuestions = new LocalQuestionRepository();
  const localExams = new LocalExamRepository();
  const supabaseQuestions = new SupabaseQuestionRepository();
  const supabaseExams = new SupabaseExamRepository();

  const questions = localQuestions.list();
  const exams = localExams.list();

  try {
    requireSupabaseClient("migration.ping");
  } catch (e) {
    return {
      success: false,
      questionsMigrated: 0,
      examsMigrated: 0,
      errors: [e instanceof Error ? e.message : "Supabase not configured"],
    };
  }

  try {
    supabaseQuestions.saveAll(questions);
    await supabaseQuestions.refreshFromRemote();

    for (const exam of exams) {
      supabaseExams.save(exam);
      await new Promise((r) => setTimeout(r, 0));
    }
    await supabaseExams.refreshFromRemote();

    if (getRepositoryMode() === "supabase") {
      await hydrateSupabaseRepositories();
    }

    logPersistenceEvent(
      "save",
      `migration:institute=${DEFAULT_INSTITUTE_ID}`,
      true,
      { questions: questions.length, exams: exams.length },
    );

    return {
      success: true,
      questionsMigrated: questions.length,
      examsMigrated: exams.length,
      errors,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Migration failed";
    errors.push(msg);
    return {
      success: false,
      questionsMigrated: 0,
      examsMigrated: 0,
      errors,
    };
  }
}
