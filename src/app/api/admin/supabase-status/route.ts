import { NextResponse } from "next/server";
import { checkSupabaseConnection } from "@/lib/supabase/check-connection";

export const dynamic = "force-dynamic";

export async function GET() {
  const report = await checkSupabaseConnection();
  return NextResponse.json(report);
}
