import { readStorageJson, writeStorageJson } from "@/lib/storage/safe-json";
import { createSupabaseClient } from "@/lib/supabase/client";
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
  const local = readStorageJson({
    storage: "local",
    key: STORAGE_KEYS.platformInstitutes,
    fallback: [],
    validate: (data) => ({ ok: true, value: data as PlatformInstitute[] }),
  });
  
  const defaultId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID;
  if (defaultId && !local.find((i) => i.id === defaultId)) {
    return [{
      id: defaultId,
      name: "ExamGrid Institute (Default)",
      city: "Remote",
      adminEmail: "admin@examgrid.com",
      plan: "Pro",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now()
    }, ...local];
  }
  return local;
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

async function persistPlatformInstituteRemote(row: PlatformInstitute): Promise<void> {
  const client = createSupabaseClient();
  if (!client) return;
  const { error } = await client.from("institutes").upsert(
    {
      id: row.id,
      name: row.name,
      slug: `${slugify(row.name).slice(0, 40)}-${row.id.split('-')[0]}`,
      contact_email: row.adminEmail || null,
      is_active: row.status === "active",
      updated_at: new Date(row.updatedAt).toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    console.warn("[ExamGrid] Platform institute remote sync failed", error.message);
    throw new Error(`Failed to sync institute to remote database: ${error.message}`);
  }
}

export async function savePlatformInstituteRemote(
  input: Parameters<typeof savePlatformInstitute>[0],
): Promise<PlatformInstitute> {
  const row = savePlatformInstitute(input);
  try {
    await persistPlatformInstituteRemote(row);
  } catch (err) {
    // If remote sync fails, remove from local storage to prevent orphaned local data
    const all = listPlatformInstitutes().filter((i) => i.id !== row.id);
    writeStorageJson("local", STORAGE_KEYS.platformInstitutes, all);
    throw err;
  }
  return row;
}

export async function createPlatformInstitute(input: {
  name: string;
  city: string;
  adminEmail: string;
  plan?: string;
}): Promise<PlatformInstitute> {
  const id = crypto.randomUUID();
  return savePlatformInstituteRemote({
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

export async function setPlatformInstituteStatusRemote(
  id: string,
  status: PlatformInstitute["status"],
): Promise<PlatformInstitute | null> {
  const existing = getPlatformInstitute(id);
  if (!existing) return null;
  return savePlatformInstituteRemote({ ...existing, status });
}

export function deletePlatformInstitute(id: string): void {
  const all = listPlatformInstitutes().filter((i) => i.id !== id);
  writeStorageJson("local", STORAGE_KEYS.platformInstitutes, all);
}

export async function deletePlatformInstituteRemote(id: string): Promise<void> {
  deletePlatformInstitute(id);
  const client = createSupabaseClient();
  if (!client) return;
  const { error } = await client.from("institutes").delete().eq("id", id);
  if (error) {
    console.warn("[ExamGrid] Platform institute remote delete failed", error.message);
  }
}
