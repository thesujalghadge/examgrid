import { DEFAULT_INSTITUTE_ID, assertInstituteUuid } from "@/config/institute";
import { getRepositoryModeFromEnv, type RepositoryMode } from "@/config/repository";

export interface ClientEnvConfigReport {
  repositoryMode: RepositoryMode;
  repositoryModeRaw: string | null;
  supabaseUrlLoaded: boolean;
  supabaseAnonKeyLoaded: boolean;
  instituteId: string;
  instituteIdLoaded: boolean;
  supabaseModeActive: boolean;
  allRequiredForSupabase: boolean;
  issues: string[];
}

export function getClientEnvConfig(): ClientEnvConfigReport {
  const repositoryModeRaw =
    process.env.NEXT_PUBLIC_REPOSITORY_MODE?.trim() ?? null;
  const repositoryMode = getRepositoryModeFromEnv();
  const supabaseUrlLoaded = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim(),
  );
  const supabaseAnonKeyLoaded = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
  const instituteId = DEFAULT_INSTITUTE_ID;
  const instituteIdLoaded = Boolean(
    process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID?.trim() ||
      instituteId === "00000000-0000-0000-0000-000000000001",
  );

  const issues: string[] = [];
  if (repositoryMode === "supabase") {
    if (!supabaseUrlLoaded) {
      issues.push("NEXT_PUBLIC_SUPABASE_URL is missing");
    }
    if (!supabaseAnonKeyLoaded) {
      issues.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing");
    }
    if (!instituteIdLoaded) {
      issues.push("NEXT_PUBLIC_DEFAULT_INSTITUTE_ID is missing");
    }

    const envInstituteId = process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID?.trim();
    if (envInstituteId) {
      try {
        assertInstituteUuid(envInstituteId, "NEXT_PUBLIC_DEFAULT_INSTITUTE_ID");
      } catch (e: any) {
        console.error(e.message);
        if (typeof process !== "undefined" && process.exit) {
          process.exit(1);
        }
      }
    }
  }

  return {
    repositoryMode,
    repositoryModeRaw,
    supabaseUrlLoaded,
    supabaseAnonKeyLoaded,
    instituteId,
    instituteIdLoaded,
    supabaseModeActive: repositoryMode === "supabase",
    allRequiredForSupabase:
      repositoryMode === "supabase"
        ? supabaseUrlLoaded &&
          supabaseAnonKeyLoaded &&
          instituteIdLoaded &&
          issues.length === 0
        : true,
    issues,
  };
}
