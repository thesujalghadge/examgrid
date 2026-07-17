"use server";

import { createSupabaseClientFromEnv } from "@/lib/supabase/client";
import { PlatformInstitute } from "@/types/platform-institute";

export async function getActiveInstitutes(): Promise<PlatformInstitute[]> {
  const supabase = createSupabaseClientFromEnv();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("institutes")
    .select("*")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch active institutes:", error.message);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    name: row.name,
    city: "Unknown", // Migrated from localstorage; could be added to DB if needed
    adminEmail: row.contact_email || "",
    status: row.is_active ? "active" : "inactive",
    plan: "Standard",
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }));
}
