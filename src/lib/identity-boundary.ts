import { isUuid } from "@/config/institute";

const TEMP_ID_PATTERN = /^(paper|cbt|temp|manual|upload|smoke|fresh)[-_]/i;

export function looksLikeTemporaryId(value: string): boolean {
  return TEMP_ID_PATTERN.test(value) || value.includes("-bank-paper-");
}

export function assertPersistedUuid(value: string, context: string): string {
  if (!isUuid(value)) {
    const kind = looksLikeTemporaryId(value) ? "temporary" : "non-uuid";
    throw new Error(`Identity boundary violation: ${context} cannot persist ${kind} id=${value}`);
  }
  return value;
}

export function createPersistenceUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  throw new Error("Identity boundary violation: crypto.randomUUID is required before persistence");
}
