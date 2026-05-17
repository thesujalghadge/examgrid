import {
  getRepositories,
  getRepositoryMode,
} from "@/lib/repositories/provider";
import { estimateStorageBytes } from "@/lib/storage/safe-json";
import { validateRepositoryContracts } from "@/lib/repositories/contract-check";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import { getAttemptStorageKey } from "@/repositories/local/local-attempt-repository";
import { parseBankQuestionList } from "@/lib/validation/bank-question-stored-schema";
import { parseExamDefinition } from "@/lib/validation/exam-schema";
import { parseJsonSafe } from "@/lib/storage/safe-json";
import { parseAuditLogList } from "@/lib/validation/audit-schema";
import { getSessionMetrics } from "@/services/audit-service";

export interface StorageKeyHealth {
  key: string;
  present: boolean;
  valid: boolean;
  itemCount?: number;
  bytesEstimate?: number;
  issue?: string;
}

export interface RepositoryDiagnostics {
  mode: string;
  healthy: boolean;
  contractOk: boolean;
  contractIssues: string[];
  localStorageBytes: number;
  sessionStorageBytes: number;
  attemptKeyCount: number;
  auditLogCount: number;
  failedOperationCount: number;
  sessionMetricCount: number;
  storageKeys: StorageKeyHealth[];
  checkedAt: string;
}

function keyBytes(storage: Storage, key: string): number {
  const val = storage.getItem(key) ?? "";
  return (key.length + val.length) * 2;
}

function checkQuestionBank(): StorageKeyHealth {
  const key = STORAGE_KEYS.questionBank;
  if (typeof window === "undefined") {
    return { key, present: false, valid: true };
  }
  const raw = localStorage.getItem(key);
  if (!raw) return { key, present: false, valid: true };
  const parsed = parseJsonSafe(raw);
  if (!parsed.ok) {
    return {
      key,
      present: true,
      valid: false,
      bytesEstimate: keyBytes(localStorage, key),
      issue: parsed.error,
    };
  }
  const list = parseBankQuestionList(parsed.value);
  return {
    key,
    present: true,
    valid: list.success,
    itemCount: list.success ? list.data.length : undefined,
    bytesEstimate: keyBytes(localStorage, key),
    issue: list.success ? undefined : list.error,
  };
}

function checkExamCatalog(): StorageKeyHealth {
  const key = STORAGE_KEYS.examCatalog;
  if (typeof window === "undefined") {
    return { key, present: false, valid: true };
  }
  const raw = localStorage.getItem(key);
  if (!raw) return { key, present: false, valid: true };
  const parsed = parseJsonSafe(raw);
  if (!parsed.ok) {
    return {
      key,
      present: true,
      valid: false,
      bytesEstimate: keyBytes(localStorage, key),
      issue: parsed.error,
    };
  }
  if (!Array.isArray(parsed.value)) {
    return {
      key,
      present: true,
      valid: false,
      issue: "Expected array",
    };
  }
  let invalid = 0;
  for (const item of parsed.value) {
    const r = parseExamDefinition(item);
    if (!r.success) invalid++;
  }
  return {
    key,
    present: true,
    valid: invalid === 0,
    itemCount: parsed.value.length,
    bytesEstimate: keyBytes(localStorage, key),
    issue: invalid > 0 ? `${invalid} invalid exam(s)` : undefined,
  };
}

function checkAuditLogs(): StorageKeyHealth {
  const key = STORAGE_KEYS.auditLogs;
  if (typeof window === "undefined") return { key, present: false, valid: true };
  const raw = localStorage.getItem(key);
  if (!raw) return { key, present: false, valid: true, itemCount: 0 };
  const parsed = parseJsonSafe(raw);
  if (!parsed.ok) {
    return { key, present: true, valid: false, issue: parsed.error };
  }
  const list = parseAuditLogList(parsed.value);
  return {
    key,
    present: true,
    valid: list.success,
    itemCount: list.success ? list.data.length : undefined,
    bytesEstimate: keyBytes(localStorage, key),
    issue: list.success ? undefined : list.error.issues[0]?.message,
  };
}

function countAttemptKeys(): number {
  if (typeof window === "undefined") return 0;
  let count = 0;
  const prefix = "examgrid:attempt:";
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) count++;
  }
  return count;
}

export function getRepositoryDiagnostics(): RepositoryDiagnostics {
  const bundle = getRepositories();
  const contract = validateRepositoryContracts(bundle);
  const auditPage = bundle.audit.list({ pageSize: 100 });
  const failedOperationCount = auditPage.rows.filter(
    (entry) => entry.outcome === "failure" || entry.outcome === "blocked",
  ).length;
  const storageKeys = [checkQuestionBank(), checkExamCatalog(), checkAuditLogs()];
  const healthy =
    contract.ok && storageKeys.every((k) => k.valid || !k.present);

  return {
    mode: getRepositoryMode(),
    healthy,
    contractOk: contract.ok,
    contractIssues: contract.issues,
    localStorageBytes: estimateStorageBytes("local"),
    sessionStorageBytes: estimateStorageBytes("session"),
    attemptKeyCount: countAttemptKeys(),
    auditLogCount: auditPage.total,
    failedOperationCount,
    sessionMetricCount: getSessionMetrics().length,
    storageKeys,
    checkedAt: new Date().toISOString(),
  };
}

/** Sample attempt key pattern for diagnostics display. */
export function formatAttemptKey(examId: string, roll: string): string {
  return getAttemptStorageKey(examId, roll);
}
