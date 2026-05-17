import {
  DEMO_BATCHES,
  DEMO_EXAMS,
  DEMO_QUESTION_BANK,
  DEMO_SCHEDULES,
  DEMO_STUDENTS,
} from "@/data/demo-data";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { getRepositories } from "@/lib/repositories/provider";
import { clearAllExamAttempts } from "@/lib/test-helpers/dev-environment";
import { recordAuditEvent } from "@/services/audit-service";

export async function resetDemoEnvironment(): Promise<void> {
  const repos = getRepositories();
  for (const schedule of repos.schedules.list()) repos.schedules.delete(schedule.id);
  for (const exam of repos.exams.list()) repos.exams.delete(exam.id);
  for (const student of repos.students.list()) repos.students.delete(student.id);
  for (const batch of repos.batches.list()) repos.batches.delete(batch.id);
  repos.questions.saveAll([]);
  clearAllExamAttempts();
  recordAuditEvent({
    actorRole: "admin",
    actionType: "session_end",
    resourceType: "demo_environment",
    resourceId: "reset",
    metadata: { action: "reset_demo_environment" },
    outcome: "warning",
  });
  await awaitRepositoryPersist();
}

export async function reseedDemoEnvironment(): Promise<void> {
  const repos = getRepositories();
  repos.questions.saveAll(DEMO_QUESTION_BANK);
  for (const batch of DEMO_BATCHES) repos.batches.save(batch);
  for (const student of DEMO_STUDENTS) repos.students.save(student);
  for (const exam of DEMO_EXAMS) repos.exams.save(exam);
  for (const schedule of DEMO_SCHEDULES) repos.schedules.save(schedule);
  recordAuditEvent({
    actorRole: "admin",
    actionType: "student_import",
    resourceType: "demo_environment",
    resourceId: "apex-jee-academy",
    metadata: {
      students: DEMO_STUDENTS.length,
      batches: DEMO_BATCHES.length,
      exams: DEMO_EXAMS.length,
      schedules: DEMO_SCHEDULES.length,
    },
  });
  await awaitRepositoryPersist();
}

export async function resetAndReseedDemoEnvironment(): Promise<void> {
  await resetDemoEnvironment();
  await reseedDemoEnvironment();
}
