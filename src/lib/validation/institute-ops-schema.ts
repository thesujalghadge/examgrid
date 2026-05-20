import { z } from "zod";
import type { Batch, ExamSchedule, InstituteStudent } from "@/types/institute-ops";

export const instituteStudentSchema = z.object({
  id: z.string().min(1),
  instituteId: z.string().min(1).optional(),
  fullName: z.string().min(1),
  email: z.string().email().or(z.literal("")),
  phone: z.string(),
  rollNumber: z.string().min(1),
  courseType: z.string().min(1),
  batchId: z.string().min(1),
  active: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const batchSchema = z.object({
  id: z.string().min(1),
  instituteId: z.string().min(1).optional(),
  name: z.string().min(1),
  courseType: z.string().min(1),
  academicYear: z.string().min(1),
  active: z.boolean(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export const examScheduleSchema = z
  .object({
    id: z.string().min(1),
    instituteId: z.string().min(1).optional(),
    examId: z.string().min(1),
    batchIds: z.array(z.string().min(1)),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    durationMinutes: z.number().int().positive(),
    visibilityRule: z.enum(["assigned_batches", "all_active_students"]),
    active: z.boolean(),
    createdAt: z.number(),
    updatedAt: z.number(),
  })
  .refine((value) => new Date(value.endAt).getTime() > new Date(value.startAt).getTime(), {
    message: "endAt must be after startAt",
    path: ["endAt"],
  })
  .refine(
    (value) =>
      value.visibilityRule === "all_active_students" || value.batchIds.length > 0,
    {
      message: "At least one batch is required for assigned batch visibility",
      path: ["batchIds"],
    },
  );

export const instituteStudentListSchema = z.array(instituteStudentSchema);
export const batchListSchema = z.array(batchSchema);
export const examScheduleListSchema = z.array(examScheduleSchema);

export function parseInstituteStudentList(data: unknown) {
  return instituteStudentListSchema.safeParse(data);
}

export function parseBatchList(data: unknown) {
  return batchListSchema.safeParse(data);
}

export function parseExamScheduleList(data: unknown) {
  return examScheduleListSchema.safeParse(data);
}

export function assertInstituteStudent(data: unknown): InstituteStudent {
  return instituteStudentSchema.parse(data);
}

export function assertBatch(data: unknown): Batch {
  return batchSchema.parse(data);
}

export function assertExamSchedule(data: unknown): ExamSchedule {
  return examScheduleSchema.parse(data);
}
