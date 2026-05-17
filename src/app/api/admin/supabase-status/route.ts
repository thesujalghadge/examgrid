import { NextResponse } from "next/server";
import { DEFAULT_INSTITUTE_ID } from "@/config/institute";
import { getRepositoryModeFromEnv } from "@/config/repository";
import { describeRepositoryMode } from "@/lib/repositories/provider";
import { checkSupabaseConnection } from "@/lib/supabase/check-connection";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await checkSupabaseConnection();
  const repository = describeRepositoryMode();
  const repositoryMode = getRepositoryModeFromEnv();

  const env = {
    repositoryMode,
    repositoryModeRaw: process.env.NEXT_PUBLIC_REPOSITORY_MODE ?? null,
    supabaseUrlLoaded: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()),
    supabaseAnonKeyLoaded: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
    ),
    instituteId: DEFAULT_INSTITUTE_ID,
    instituteIdFromEnv: process.env.NEXT_PUBLIC_DEFAULT_INSTITUTE_ID ?? null,
    supabaseModeActive: repositoryMode === "supabase",
  };

  return NextResponse.json({ supabase, repository, env });
}
