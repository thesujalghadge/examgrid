import { NextResponse } from "next/server";
import { logSessionWarning } from "@/lib/logging/runtime-logger";
import {
  createSessionExpiry,
  getSessionSecret,
  signSessionToken,
} from "@/lib/session-crypto";
import { isInstituteScopedRole } from "@/lib/access-control";
import { WORKSPACE_SESSION_COOKIE } from "@/lib/workspace-session";
import {
  logSessionCreated,
  readVerifiedWorkspaceSession,
} from "@/lib/workspace-session-server";
import type { UserRole, WorkspaceSession } from "@/types/access-control";

const COOKIE_OPTS = {
  path: "/",
  sameSite: "lax" as const,
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
};

function validRole(role: unknown): role is UserRole {
  return (
    role === "platform_admin" ||
    role === "institute" ||
    role === "parent" ||
    role === "student"
  );
}

export async function GET() {
  const session = await readVerifiedWorkspaceSession();
  if (!session) {
    return NextResponse.json({ session: null }, { status: 401 });
  }
  return NextResponse.json({ session });
}

export async function POST(request: Request) {
  let body: Partial<WorkspaceSession>;
  try {
    body = (await request.json()) as Partial<WorkspaceSession>;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!body.userId?.trim() || !validRole(body.role)) {
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }

  if (isInstituteScopedRole(body.role) && !body.instituteId?.trim()) {
    return NextResponse.json({ error: "instituteId required" }, { status: 400 });
  }

  if (body.instituteId?.trim()) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const { data: institute, error } = await supabase
      .from("institutes")
      .select("id")
      .eq("id", body.instituteId.trim())
      .maybeSingle();
      
    if (error || !institute) {
      return NextResponse.json({ error: "GHOST_INSTITUTE" }, { status: 403 });
    }
  }

  const session: WorkspaceSession = {
    userId: body.userId.trim(),
    role: body.role,
    instituteId: body.instituteId?.trim() || undefined,
    expiresAt: createSessionExpiry(),
  };

  const token = signSessionToken(session, getSessionSecret());
  logSessionCreated(session);

  const res = NextResponse.json({ session });
  res.cookies.set(WORKSPACE_SESSION_COOKIE, token, {
    ...COOKIE_OPTS,
    maxAge: Math.floor((session.expiresAt - Date.now()) / 1000),
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(WORKSPACE_SESSION_COOKIE, "", { ...COOKIE_OPTS, maxAge: 0 });
  return res;
}

/** Refresh expiry (touch). */
export async function PATCH() {
  const existing = await readVerifiedWorkspaceSession();
  if (!existing) {
    logSessionWarning("session touch rejected", { reason: "no_valid_session" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session: WorkspaceSession = {
    ...existing,
    expiresAt: createSessionExpiry(),
  };
  const token = signSessionToken(session, getSessionSecret());
  const res = NextResponse.json({ session });
  res.cookies.set(WORKSPACE_SESSION_COOKIE, token, {
    ...COOKIE_OPTS,
    maxAge: Math.floor((session.expiresAt - Date.now()) / 1000),
  });
  return res;
}
