import { createSupabaseClient } from "@/lib/supabase/client";
import type { PlatformInstitute } from "@/types/platform-institute";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function listPlatformInstitutes(): Promise<PlatformInstitute[]> {
  const client = createSupabaseClient();
  if (!client) return [];
  const { data, error } = await client.from("institutes").select("*").order("name", { ascending: true });
  if (error) {
    console.warn("[ExamGrid] Platform institute list failed", error.message);
    return [];
  }
  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    city: "Unknown", // Migrated field
    adminEmail: row.contact_email || "",
    status: row.is_active ? "active" : "inactive",
    plan: "Standard",
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }));
}

export async function getPlatformInstitute(id: string): Promise<PlatformInstitute | undefined> {
  const client = createSupabaseClient();
  if (!client) return undefined;
  const { data, error } = await client.from("institutes").select("*").eq("id", id).maybeSingle();
  if (error || !data) return undefined;
  
  return {
    id: data.id,
    name: data.name,
    city: "Unknown",
    adminEmail: data.contact_email || "",
    status: data.is_active ? "active" : "inactive",
    plan: "Standard",
    createdAt: new Date(data.created_at).getTime(),
    updatedAt: new Date(data.updated_at).getTime(),
  };
}

export async function savePlatformInstituteRemote(
  input: Omit<PlatformInstitute, "createdAt" | "updatedAt"> & {
    createdAt?: number;
    updatedAt?: number;
  },
): Promise<PlatformInstitute> {
  const client = createSupabaseClient();
  if (!client) throw new Error("Supabase client not available");
  
  const now = Date.now();
  const createdAt = input.createdAt ?? now;
  const updatedAt = now;

  const { error } = await client.from("institutes").upsert(
    {
      id: input.id,
      name: input.name,
      slug: `${slugify(input.name).slice(0, 40)}-${input.id.split('-')[0]}`,
      contact_email: input.adminEmail || null,
      is_active: input.status === "active",
      updated_at: new Date(updatedAt).toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("[ExamGrid] Platform institute remote sync failed", error.message);
    throw new Error(`Failed to sync institute to remote database: ${error.message}`);
  }

  return {
    ...input,
    createdAt,
    updatedAt,
  };
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

export async function setPlatformInstituteStatusRemote(
  id: string,
  status: PlatformInstitute["status"],
): Promise<PlatformInstitute | null> {
  const existing = await getPlatformInstitute(id);
  if (!existing) return null;
  return savePlatformInstituteRemote({ ...existing, status });
}

export async function deletePlatformInstituteRemote(id: string): Promise<void> {
  const client = createSupabaseClient();
  if (!client) return;
  const { error } = await client.from("institutes").delete().eq("id", id);
  if (error) {
    console.warn("[ExamGrid] Platform institute remote delete failed", error.message);
  }
}
