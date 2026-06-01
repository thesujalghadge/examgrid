import type {
  BatchRow,
  ExamScheduleRow,
  StudentRow,
} from "@/repositories/supabase/types";
import type { Batch, ExamSchedule, InstituteStudent } from "@/types/institute-ops";

function requireInstituteId(value: string | undefined, entity: string): string {
  if (!value) throw new Error(`${entity} is missing instituteId`);
  return value;
}

export function studentToRow(student: InstituteStudent): Omit<StudentRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
} {
  return {
    id: student.id,
    institute_id: requireInstituteId(student.instituteId, "student"),
    name: student.fullName,
    full_name: student.fullName,
    email: student.email || null,
    phone: student.phone || null,
    roll_number: student.rollNumber,
    application_number: student.rollNumber,
    course_type: student.courseType,
    batch_id: student.batchId || null,
    is_active: student.active,
    created_at: new Date(student.createdAt).toISOString(),
    updated_at: new Date(student.updatedAt).toISOString(),
  };
}

export function rowToStudent(row: StudentRow): InstituteStudent {
  return {
    id: row.id,
    instituteId: row.institute_id,
    fullName: row.full_name,
    email: row.email ?? "",
    phone: row.phone ?? "",
    rollNumber: row.roll_number,
    courseType: row.course_type,
    batchId: row.batch_id ?? "",
    active: row.is_active,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function batchToRow(batch: Batch): Omit<BatchRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
} {
  return {
    id: batch.id,
    institute_id: requireInstituteId(batch.instituteId, "batch"),
    name: batch.name,
    course_type: batch.courseType,
    academic_year: batch.academicYear,
    is_active: batch.active,
    created_at: new Date(batch.createdAt).toISOString(),
    updated_at: new Date(batch.updatedAt).toISOString(),
  };
}

export function rowToBatch(row: BatchRow): Batch {
  return {
    id: row.id,
    instituteId: row.institute_id,
    name: row.name,
    courseType: row.course_type,
    academicYear: row.academic_year,
    active: row.is_active,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

export function scheduleToRow(
  schedule: ExamSchedule,
): Omit<ExamScheduleRow, "created_at" | "updated_at"> & {
  created_at?: string;
  updated_at?: string;
} {
  return {
    id: schedule.id,
    institute_id: requireInstituteId(schedule.instituteId, "schedule"),
    exam_id: schedule.examId,
    start_at: schedule.startAt,
    end_at: schedule.endAt,
    duration_minutes: schedule.durationMinutes,
    visibility_rule: schedule.visibilityRule,
    is_active: schedule.active,
    created_at: new Date(schedule.createdAt).toISOString(),
    updated_at: new Date(schedule.updatedAt).toISOString(),
  };
}

export function rowToSchedule(
  row: ExamScheduleRow,
  batchIds: string[],
): ExamSchedule {
  return {
    id: row.id,
    instituteId: row.institute_id,
    examId: row.exam_id,
    batchIds,
    startAt: row.start_at,
    endAt: row.end_at,
    durationMinutes: row.duration_minutes,
    visibilityRule: row.visibility_rule,
    active: row.is_active,
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
