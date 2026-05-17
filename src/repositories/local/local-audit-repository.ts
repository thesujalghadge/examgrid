import { readStorageJson, writeStorageJson, removeStorageKey } from "@/lib/storage/safe-json";
import {
  assertAuditLogEntry,
  parseAuditLogList,
} from "@/lib/validation/audit-schema";
import type { AuditRepository } from "@/repositories/interfaces/audit-repository";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { AuditLogEntry, AuditLogPage, AuditLogQuery } from "@/types/audit";

const MAX_LOCAL_AUDIT_ROWS = 1000;

function matchesQuery(entry: AuditLogEntry, query: AuditLogQuery): boolean {
  const search = query.search?.trim().toLowerCase();
  if (search) {
    const haystack = [
      entry.actorId,
      entry.actionType,
      entry.resourceType,
      entry.resourceId,
      entry.outcome,
      JSON.stringify(entry.metadata),
    ]
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(search)) return false;
  }
  if (query.actorId && !entry.actorId.toLowerCase().includes(query.actorId.toLowerCase())) {
    return false;
  }
  if (query.actionType && entry.actionType !== query.actionType) return false;
  if (query.resourceType && entry.resourceType !== query.resourceType) return false;
  if (query.startUTC && entry.timestampUTC < query.startUTC) return false;
  if (query.endUTC && entry.timestampUTC > query.endUTC) return false;
  return true;
}

export class LocalAuditRepository implements AuditRepository {
  private readAll(): AuditLogEntry[] {
    return readStorageJson({
      storage: "local",
      key: STORAGE_KEYS.auditLogs,
      fallback: [],
      validate: (data) => {
        const result = parseAuditLogList(data);
        if (!result.success) {
          return {
            ok: false,
            error: result.error.issues.map((i) => i.message).join("; "),
          };
        }
        return { ok: true, value: result.data as AuditLogEntry[] };
      },
    });
  }

  append(entry: AuditLogEntry): void {
    const valid = assertAuditLogEntry(entry);
    const next = [valid, ...this.readAll()].slice(0, MAX_LOCAL_AUDIT_ROWS);
    writeStorageJson("local", STORAGE_KEYS.auditLogs, next);
  }

  list(query: AuditLogQuery = {}): AuditLogPage {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 25));
    const filtered = this.readAll().filter((entry) => matchesQuery(entry, query));
    return {
      rows: filtered.slice((page - 1) * pageSize, page * pageSize),
      total: filtered.length,
      page,
      pageSize,
    };
  }

  clear(): void {
    removeStorageKey("local", STORAGE_KEYS.auditLogs);
  }
}
