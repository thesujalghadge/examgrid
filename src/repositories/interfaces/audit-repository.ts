import type { AuditLogEntry, AuditLogPage, AuditLogQuery } from "@/types/audit";

export interface AuditRepository {
  append(entry: AuditLogEntry): void;
  list(query?: AuditLogQuery): AuditLogPage;
  clear(): void;
}
