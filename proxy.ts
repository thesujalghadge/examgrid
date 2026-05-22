import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ROLE_HOME, ROLE_LOGIN, isInstituteScopedRole } from "@/lib/access-control";
import { verifySessionToken } from "@/lib/session-crypto";
import { WORKSPACE_SESSION_COOKIE } from "@/lib/workspace-session";

function loginForPath(pathname: string) {
  if (pathname.startsWith("/platform")) return ROLE_LOGIN.platform_admin;
  if (pathname.startsWith("/institute")) return ROLE_LOGIN.institute;
  if (pathname.startsWith("/parent")) return ROLE_LOGIN.parent;
  return ROLE_LOGIN.student;
}

function requiredRole(pathname: string) {
  if (pathname.startsWith("/platform")) return "platform_admin";
  if (pathname.startsWith("/institute")) return "institute";
  if (pathname.startsWith("/parent")) return "parent";
  if (pathname.startsWith("/student")) return "student";
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    !pathname.startsWith("/platform") &&
    !pathname.startsWith("/institute") &&
    !pathname.startsWith("/parent") &&
    !pathname.startsWith("/student")
  ) {
    return NextResponse.next();
  }

  if (pathname.endsWith("/login")) return NextResponse.next();

  const raw = request.cookies.get(WORKSPACE_SESSION_COOKIE)?.value;
  const token = raw ? decodeURIComponent(raw) : null;
  const session = verifySessionToken(token);

  if (!session) {
    return NextResponse.redirect(new URL(loginForPath(pathname), request.url));
  }

  const expectedRole = requiredRole(pathname);
  if (expectedRole && session.role !== expectedRole) {
    return NextResponse.redirect(new URL(ROLE_HOME[session.role], request.url));
  }

  if (isInstituteScopedRole(session.role) && !session.instituteId) {
    const res = NextResponse.redirect(new URL(ROLE_LOGIN[session.role], request.url));
    res.cookies.set(WORKSPACE_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/platform/:path*",
    "/institute/:path*",
    "/parent/:path*",
    "/student/:path*",
  ],
};
