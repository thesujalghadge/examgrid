import { logRepositoryFailure } from "@/lib/logging/runtime-logger";
import { getClientWorkspaceSession } from "@/lib/workspace-session";
import { assertAuditLogEntry } from "@/lib/validation/audit-schema";
import type { AuditRepository } from "@/repositories/interfaces/audit-repository";
import {
  requireSupabaseClient,
  throwIfSupabaseError,
} from "@/repositories/supabase/supabase-repo-utils";
import type { AuditLogEntry, AuditLogPage, AuditLogQuery } from "@/types/audit";

interface AuditRow {
  event_id: string;
  institute_id: string;
  actor_id: string;
  actor_role: AuditLogEntry["actorRole"];
  action_type: string;
  resource_type: string;
  resource_id: string;
  timestamp_utc: string;
  session_id: string;
  source: string;
  metadata: Record<string, unknown>;
  outcome: AuditLogEntry["outcome"];
}

function entryToRow(entry: AuditLogEntry, instituteId: string): AuditRow {
  return {
    event_id: entry.eventId,
    institute_id: instituteId,
    actor_id: entry.actorId,
    actor_role: entry.actorRole,
    action_type: entry.actionType,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId,
    timestamp_utc: entry.timestampUTC,
    session_id: entry.sessionId,
    source: entry.source,
    metadata: entry.metadata,
    outcome: entry.outcome,
  };
}

function rowToEntry(row: AuditRow): AuditLogEntry {
  return {
    eventId: row.event_id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    actionType: row.action_type as AuditLogEntry["actionType"],
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    timestampUTC: row.timestamp_utc,
    sessionId: row.session_id,
    source: row.source,
    metadata: row.metadata ?? {},
    outcome: row.outcome,
  };
}

export class SupabaseAuditRepository implements AuditRepository {
  private persistChain: Promise<void> = Promise.resolve();

  append(entry: AuditLogEntry): void {
    const valid = assertAuditLogEntry(entry);
    this.persistChain = this.persistChain
      .then(() => this.persistOne(valid))
      .catch((error) => {
        logRepositoryFailure("SupabaseAuditRepository.append", error);
      });
  }

  async whenIdle(): Promise<void> {
    await this.persistChain;
  }

  list(query: AuditLogQuery = {}): AuditLogPage {
    void query;
    return { rows: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 25 };
  }

  async listAsync(query: AuditLogQuery = {}): Promise<AuditLogPage> {
    const session = getClientWorkspaceSession();
    if (!session?.instituteId) {
      return { rows: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 25 };
    }
    const client = requireSupabaseClient("audit_logs.list");
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(10, query.pageSize ?? 25));
    let req = client
      .from("audit_logs")
      .select("*", { count: "exact" })
      .eq("institute_id", session.instituteId)
      .order("timestamp_utc", { ascending: false });

    if (query.actorId) req = req.ilike("actor_id", `%${query.actorId}%`);
    if (query.actionType) req = req.eq("action_type", query.actionType);
    if (query.resourceType) req = req.eq("resource_type", query.resourceType);
    if (query.startUTC) req = req.gte("timestamp_utc", query.startUTC);
    if (query.endUTC) req = req.lte("timestamp_utc", query.endUTC);
    if (query.search) {
      const s = `%${query.search}%`;
      req = req.or(
        `actor_id.ilike.${s},action_type.ilike.${s},resource_type.ilike.${s},resource_id.ilike.${s}`,
      );
    }

    const { data, error, count } = await req.range(
      (page - 1) * pageSize,
      page * pageSize - 1,
    );
    throwIfSupabaseError(error, "audit_logs", "list");
    return {
      rows: ((data ?? []) as AuditRow[]).map(rowToEntry),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  clear(): void {
    logRepositoryFailure("SupabaseAuditRepository.clear", "Audit log clear is disabled");
  }

  private async persistOne(entry: AuditLogEntry): Promise<void> {
    const session = getClientWorkspaceSession();
    if (!session?.instituteId) return;
    const client = requireSupabaseClient("audit_logs.insert");
    const { error } = await client.from("audit_logs").insert(entryToRow(entry, session.instituteId));
    throwIfSupabaseError(error, "audit_logs", "insert");
  }
}
