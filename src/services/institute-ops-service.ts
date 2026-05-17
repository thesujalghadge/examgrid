import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { getRepositories } from "@/lib/repositories/provider";
import type { Candidate, ExamDefinition, PersistedExamAttempt } from "@/types/exam";
import type {
  Batch,
  ExamSchedule,
  InstituteStudent,
  ScheduledExamStatus,
  ScheduledExamView,
  StudentImportPreview,
  StudentImportPreviewRow,
} from "@/types/institute-ops";

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createBatchInput(input: {
  name: string;
  courseType: string;
  academicYear: string;
  active?: boolean;
}): Batch {
  const now = Date.now();
  return {
    id: makeId("batch"),
    name: input.name.trim(),
    courseType: input.courseType.trim(),
    academicYear: input.academicYear.trim(),
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createStudentInput(input: {
  fullName: string;
  email: string;
  phone: string;
  rollNumber: string;
  courseType: string;
  batchId: string;
  active?: boolean;
}): InstituteStudent {
  const now = Date.now();
  return {
    id: makeId("student"),
    fullName: input.fullName.trim(),
    email: input.email.trim(),
    phone: input.phone.trim(),
    rollNumber: input.rollNumber.trim(),
    courseType: input.courseType.trim(),
    batchId: input.batchId,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

export function createScheduleInput(input: {
  examId: string;
  batchIds: string[];
  startAt: string;
  endAt: string;
  durationMinutes: number;
  visibilityRule: ExamSchedule["visibilityRule"];
  active?: boolean;
}): ExamSchedule {
  const now = Date.now();
  return {
    id: makeId("schedule"),
    examId: input.examId,
    batchIds: input.batchIds,
    startAt: new Date(input.startAt).toISOString(),
    endAt: new Date(input.endAt).toISOString(),
    durationMinutes: input.durationMinutes,
    visibilityRule: input.visibilityRule,
    active: input.active ?? true,
    createdAt: now,
    updatedAt: now,
  };
}

export function getScheduleStatus(
  schedule: ExamSchedule,
  now = Date.now(),
): ScheduledExamStatus {
  const start = new Date(schedule.startAt).getTime();
  const end = new Date(schedule.endAt).getTime();
  if (now < start) return "upcoming";
  if (now <= end) return "active";
  return "completed";
}

export function isScheduleAssignedToStudent(
  schedule: ExamSchedule,
  student: InstituteStudent,
): boolean {
  if (!schedule.active || !student.active) return false;
  if (schedule.visibilityRule === "all_active_students") return true;
  return schedule.batchIds.includes(student.batchId);
}

export function listAssignedScheduledExams(
  student: InstituteStudent | null,
  exams: ExamDefinition[],
  schedules: ExamSchedule[],
  now = Date.now(),
): ScheduledExamView[] {
  if (!student) return [];
  const examById = new Map(exams.map((exam) => [exam.id, exam]));
  return schedules
    .filter((schedule) => isScheduleAssignedToStudent(schedule, student))
    .map((schedule) => {
      const exam = examById.get(schedule.examId);
      if (!exam) return null;
      return { exam, schedule, status: getScheduleStatus(schedule, now) };
    })
    .filter((item): item is ScheduledExamView => item !== null)
    .sort(
      (a, b) =>
        new Date(a.schedule.startAt).getTime() -
        new Date(b.schedule.startAt).getTime(),
    );
}

export function findStudentForCandidate(
  candidate: Candidate | null,
): InstituteStudent | null {
  if (!candidate) return null;
  return getRepositories().students.getByRollNumber(candidate.rollNumber) ?? null;
}

export function isOperationalSchedulingActive(): boolean {
  return getRepositories().schedules.list().length > 0;
}

export function canStudentAccessExam(
  student: InstituteStudent | null,
  examId: string,
  schedules: ExamSchedule[],
  now = Date.now(),
): boolean {
  if (!student) return false;
  return schedules.some(
    (schedule) =>
      schedule.examId === examId &&
      isScheduleAssignedToStudent(schedule, student) &&
      getScheduleStatus(schedule, now) === "active",
  );
}

export function canCandidateAccessExam(candidate: Candidate | null, examId: string): boolean {
  const repos = getRepositories();
  const schedules = repos.schedules.list();
  if (schedules.length === 0) return Boolean(candidate);
  return canStudentAccessExam(
    findStudentForCandidate(candidate),
    examId,
    schedules,
  );
}

export function getActiveScheduleForRoll(
  examId: string,
  rollNumber: string,
): ExamSchedule | null {
  const repos = getRepositories();
  const student = repos.students.getByRollNumber(rollNumber);
  if (!student) return null;
  return (
    repos.schedules
      .listByExamId(examId)
      .find(
        (schedule) =>
          isScheduleAssignedToStudent(schedule, student) &&
          getScheduleStatus(schedule) === "active",
      ) ?? null
  );
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === "," && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values;
}

export function previewStudentCsvImport(
  csv: string,
  existing: InstituteStudent[],
  batches: Batch[],
): StudentImportPreview {
  const lines = csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return { rows: [], validCount: 0, duplicateCount: 0, errorCount: 0 };
  }

  const headers = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const existingRolls = new Set(
    existing.map((student) => student.rollNumber.trim().toLowerCase()),
  );
  const batchNames = new Map(
    batches.map((batch) => [batch.name.trim().toLowerCase(), batch.id]),
  );
  const batchIds = new Set(batches.map((batch) => batch.id));
  const seen = new Set<string>();

  const rows: StudentImportPreviewRow[] = lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line);
    const record = Object.fromEntries(
      headers.map((header, i) => [header, values[i] ?? ""]),
    );
    const batchValue = String(record.batchid || record.batch || "").trim();
    const batchId = batchIds.has(batchValue)
      ? batchValue
      : batchNames.get(batchValue.toLowerCase()) ?? batchValue;
    const rollNumber = String(record.rollnumber || record.roll_number || "").trim();
    const normalizedRoll = rollNumber.toLowerCase();
    const duplicate = existingRolls.has(normalizedRoll) || seen.has(normalizedRoll);
    seen.add(normalizedRoll);

    const student = {
      fullName: String(record.fullname || record.name || "").trim(),
      email: String(record.email || "").trim(),
      phone: String(record.phone || "").trim(),
      rollNumber,
      courseType: String(record.coursetype || record.course || "").trim(),
      batchId,
      active: String(record.active || "true").toLowerCase() !== "false",
    };

    const errors: string[] = [];
    if (!student.fullName) errors.push("fullName required");
    if (!student.rollNumber) errors.push("rollNumber required");
    if (!student.courseType) errors.push("courseType required");
    if (!student.batchId || !batchIds.has(student.batchId)) {
      errors.push("batchId/batch must match an existing batch");
    }
    if (student.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) {
      errors.push("email is invalid");
    }
    if (duplicate) errors.push("duplicate rollNumber");

    return {
      index: index + 2,
      student,
      duplicate,
      errors,
    };
  });

  return {
    rows,
    validCount: rows.filter((row) => row.errors.length === 0).length,
    duplicateCount: rows.filter((row) => row.duplicate).length,
    errorCount: rows.filter((row) => row.errors.length > 0).length,
  };
}

export async function importPreviewedStudents(
  preview: StudentImportPreview,
): Promise<number> {
  const { students } = getRepositories();
  let imported = 0;
  for (const row of preview.rows) {
    if (row.errors.length > 0) continue;
    students.save(createStudentInput(row.student));
    imported += 1;
  }
  await awaitRepositoryPersist();
  return imported;
}

export function getCompletedExamIds(
  attempts: PersistedExamAttempt[],
): Set<string> {
  return new Set(
    attempts
      .filter((attempt) => attempt.lifecycle === "submitted" || attempt.result)
      .map((attempt) => attempt.examId),
  );
}
