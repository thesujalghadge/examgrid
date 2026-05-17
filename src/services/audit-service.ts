import { getRepositories } from "@/lib/repositories/provider";
import { getRepositoryMode } from "@/lib/repositories/provider";
import { SupabaseAuditRepository } from "@/repositories/supabase/supabase-audit-repository";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type {
  AuditActionType,
  AuditActorRole,
  AuditLogEntry,
  AuditOutcome,
  AuditLogPage,
  AuditLogQuery,
} from "@/types/audit";

const SESSION_ID_KEY = "examgrid:session-id";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `audit-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";
  const existing = sessionStorage.getItem(SESSION_ID_KEY);
  if (existing) return existing;
  const id = makeId();
  sessionStorage.setItem(SESSION_ID_KEY, id);
  return id;
}

export function clearSessionId(): void {
  if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_ID_KEY);
}

export function recordAuditEvent(input: {
  actorId?: string;
  actorRole: AuditActorRole;
  actionType: AuditActionType;
  resourceType: string;
  resourceId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  outcome?: AuditOutcome;
}): AuditLogEntry {
  const entry: AuditLogEntry = {
    eventId: makeId(),
    actorId: input.actorId?.trim() || "anonymous",
    actorRole: input.actorRole,
    actionType: input.actionType,
    resourceType: input.resourceType,
    resourceId: input.resourceId?.trim() || "n/a",
    timestampUTC: new Date().toISOString(),
    sessionId: getOrCreateSessionId(),
    source: input.source ?? "web",
    metadata: input.metadata ?? {},
    outcome: input.outcome ?? "success",
  };
  getRepositories().audit.append(entry);
  return entry;
}

export interface SessionMetric {
  sessionId: string;
  actorId: string;
  actorRole: AuditActorRole;
  startedAtUTC: string;
  endedAtUTC?: string;
  reason?: string;
}

export function appendSessionMetric(metric: SessionMetric): void {
  if (typeof window === "undefined") return;
  const raw = localStorage.getItem(STORAGE_KEYS.sessionMetrics);
  const existing = raw ? (JSON.parse(raw) as SessionMetric[]) : [];
  localStorage.setItem(
    STORAGE_KEYS.sessionMetrics,
    JSON.stringify([metric, ...existing].slice(0, 200)),
  );
}

export function getSessionMetrics(): SessionMetric[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.sessionMetrics);
    return raw ? (JSON.parse(raw) as SessionMetric[]) : [];
  } catch {
    return [];
  }
}

export async function listAuditLogs(
  query: AuditLogQuery = {},
): Promise<AuditLogPage> {
  const repo = getRepositories().audit;
  if (getRepositoryMode() === "supabase" && "listAsync" in repo) {
    return (repo as SupabaseAuditRepository).listAsync(query);
  }
  return repo.list(query);
}

export async function flushAuditLogs(): Promise<void> {
  const repo = getRepositories().audit;
  const maybe = repo as { whenIdle?: () => Promise<void> };
  if (typeof maybe.whenIdle === "function") {
    await maybe.whenIdle();
  }
}
