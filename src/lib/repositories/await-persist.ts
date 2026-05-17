import { getRepositoryMode } from "@/lib/repositories/provider";
import { getRepositories } from "@/lib/repositories/provider";
import { SupabaseExamRepository } from "@/repositories/supabase/supabase-exam-repository";
import { SupabaseQuestionRepository } from "@/repositories/supabase/supabase-question-repository";
import { SupabaseStudentRepository } from "@/repositories/supabase/supabase-student-repository";
import { SupabaseBatchRepository } from "@/repositories/supabase/supabase-batch-repository";
import { SupabaseScheduleRepository } from "@/repositories/supabase/supabase-schedule-repository";
import { SupabaseAuditRepository } from "@/repositories/supabase/supabase-audit-repository";

/** Flush pending Supabase writes before navigation (admin flows). */
export async function awaitRepositoryPersist(): Promise<void> {
  if (getRepositoryMode() !== "supabase") return;
  const { questions, exams, students, batches, schedules, audit } = getRepositories();
  await Promise.all([
    (questions as SupabaseQuestionRepository).whenIdle(),
    (exams as SupabaseExamRepository).whenIdle(),
    (students as SupabaseStudentRepository).whenIdle(),
    (batches as SupabaseBatchRepository).whenIdle(),
    (schedules as SupabaseScheduleRepository).whenIdle(),
    (audit as SupabaseAuditRepository).whenIdle(),
  ]);
}
