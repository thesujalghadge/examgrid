import { readStorageJson, writeStorageJson } from "@/lib/storage/safe-json";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import type { PlatformInstitute } from "@/types/platform-institute";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function listPlatformInstitutes(): PlatformInstitute[] {
  if (typeof window === "undefined") return [];
  return readStorageJson({
    storage: "local",
    key: STORAGE_KEYS.platformInstitutes,
    fallback: [],
    validate: (data) => ({ ok: true, value: data as PlatformInstitute[] }),
  });
}

export function getPlatformInstitute(id: string): PlatformInstitute | undefined {
  return listPlatformInstitutes().find((i) => i.id === id);
}

export function getInstituteDisplayName(id: string | undefined): string {
  if (!id) return "Institute";
  return getPlatformInstitute(id)?.name ?? id;
}

export function savePlatformInstitute(
  input: Omit<PlatformInstitute, "createdAt" | "updatedAt"> & {
    createdAt?: number;
    updatedAt?: number;
  },
): PlatformInstitute {
  const now = Date.now();
  const row: PlatformInstitute = {
    ...input,
    createdAt: input.createdAt ?? now,
    updatedAt: now,
  };
  const all = listPlatformInstitutes().filter((i) => i.id !== row.id);
  all.push(row);
  writeStorageJson("local", STORAGE_KEYS.platformInstitutes, all);
  return row;
}

export function createPlatformInstitute(input: {
  name: string;
  city: string;
  adminEmail: string;
  plan?: string;
}): PlatformInstitute {
  const baseId = slugify(input.name) || "institute";
  let id = baseId;
  let n = 1;
  while (getPlatformInstitute(id)) {
    id = `${baseId}-${n}`;
    n += 1;
  }
  return savePlatformInstitute({
    id,
    name: input.name.trim(),
    city: input.city.trim(),
    adminEmail: input.adminEmail.trim(),
    plan: input.plan?.trim() || "Standard",
    status: "active",
  });
}

export function setPlatformInstituteStatus(
  id: string,
  status: PlatformInstitute["status"],
): PlatformInstitute | null {
  const existing = getPlatformInstitute(id);
  if (!existing) return null;
  return savePlatformInstitute({ ...existing, status });
}

export function deletePlatformInstitute(id: string): void {
  const all = listPlatformInstitutes().filter((i) => i.id !== id);
  writeStorageJson("local", STORAGE_KEYS.platformInstitutes, all);
}
