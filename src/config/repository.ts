export type RepositoryMode = "local" | "supabase";

export function getRepositoryModeFromEnv(): RepositoryMode {
  const raw = process.env.NEXT_PUBLIC_REPOSITORY_MODE?.trim().toLowerCase();
  return raw === "supabase" ? "supabase" : "local";
}
