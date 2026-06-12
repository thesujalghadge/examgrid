import {
  getScheduleStatus,
  isScheduleAssignedToStudent,
} from "@/services/institute-ops-service";
import type { CBTTest } from "@/types/cbt";
import type {
  ExamSchedule,
  InstituteStudent,
  ScheduledExamStatus,
} from "@/types/institute-ops";

export function listAssignedCbtTests(
  student: InstituteStudent | null,
  tests: CBTTest[],
  schedules: ExamSchedule[],
  now = Date.now(),
): { test: CBTTest; schedule: ExamSchedule; status: ScheduledExamStatus }[] {
  if (!student) return [];
  const testIds = new Set(tests.map((t) => t.id));
  return schedules
    .filter(
      (s) =>
        testIds.has(s.examId) &&
        isScheduleAssignedToStudent(s, student) &&
        (!s.instituteId ||
          !student.instituteId ||
          s.instituteId === student.instituteId),
    )
    .map((schedule) => {
      const test = tests.find((t) => t.id === schedule.examId);
      if (
        test &&
        student.instituteId &&
        test.instituteId !== student.instituteId
      ) {
        return null;
      }
      if (!test) return null;
      return { test, schedule, status: getScheduleStatus(schedule, now) };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort(
      (a, b) =>
        new Date(a.schedule.startAt).getTime() -
        new Date(b.schedule.startAt).getTime(),
    );
}

import type { ExamDefinition } from "@/types/exam";

export function listAssignedExams(
  student: InstituteStudent | null,
  exams: ExamDefinition[],
  schedules: ExamSchedule[],
  now = Date.now(),
): { exam: ExamDefinition; schedule: ExamSchedule; status: ScheduledExamStatus }[] {
  if (!student) return [];
  const examIds = new Set(exams.map((e) => e.id));
  return schedules
    .filter(
      (s) =>
        examIds.has(s.examId) &&
        isScheduleAssignedToStudent(s, student) &&
        (!s.instituteId ||
          !student.instituteId ||
          s.instituteId === student.instituteId),
    )
    .map((schedule) => {
      const exam = exams.find((e) => e.id === schedule.examId);
      if (!exam) return null;
      // ExamDefinition doesn't natively have instituteId inside it (stored in DB though)
      // but if the schedule matches, we trust it.
      return { exam, schedule, status: getScheduleStatus(schedule, now) };
    })
    .filter((v): v is NonNullable<typeof v> => v !== null)
    .sort(
      (a, b) =>
        new Date(a.schedule.startAt).getTime() -
        new Date(b.schedule.startAt).getTime(),
    );
}
