import { z } from "zod";
import type { AuditLogEntry } from "@/types/audit";

export const auditLogEntrySchema = z.object({
  eventId: z.string().min(1),
  actorId: z.string().min(1),
  actorRole: z.enum(["admin", "student", "system"]),
  actionType: z.string().min(1),
  resourceType: z.string().min(1),
  resourceId: z.string().min(1),
  timestampUTC: z.string().datetime(),
  sessionId: z.string().min(1),
  source: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
  outcome: z.enum(["success", "failure", "blocked", "warning"]),
});

export const auditLogListSchema = z.array(auditLogEntrySchema);

export function parseAuditLogList(data: unknown) {
  return auditLogListSchema.safeParse(data);
}

export function assertAuditLogEntry(data: unknown): AuditLogEntry {
  return auditLogEntrySchema.parse(data) as AuditLogEntry;
}
