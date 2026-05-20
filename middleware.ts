import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ROLE_HOME } from "@/lib/access-control";
import { verifySessionToken } from "@/lib/session-crypto";
import { WORKSPACE_SESSION_COOKIE } from "@/lib/workspace-session";

function roleHome(role: string) {
  if (role === "super_admin") return ROLE_HOME.super_admin;
  if (role === "institute_admin" || role === "teacher") return ROLE_HOME.institute_admin;
  return ROLE_HOME.student;
}

function loginForPath(pathname: string) {
  if (pathname.startsWith("/platform")) return "/platform/login";
  if (pathname.startsWith("/institute")) return "/institute/login";
  return "/student/login";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    !pathname.startsWith("/platform") &&
    !pathname.startsWith("/institute") &&
    !pathname.startsWith("/student")
  ) {
    return NextResponse.next();
  }

  const isLoginPath =
    pathname.startsWith("/platform/login") ||
    pathname.startsWith("/institute/login") ||
    pathname.startsWith("/student/login");
  if (isLoginPath) return NextResponse.next();

  const raw = request.cookies.get(WORKSPACE_SESSION_COOKIE)?.value;
  const token = raw ? decodeURIComponent(raw) : null;
  const session = verifySessionToken(token);

  if (!session) {
    console.info(
      JSON.stringify({
        level: "warn",
        category: "session",
        event: "route access denied",
        pathname,
        reason: "missing_or_invalid_session",
      }),
    );
    return NextResponse.redirect(new URL(loginForPath(pathname), request.url));
  }

  if (pathname.startsWith("/platform") && session.role !== "super_admin") {
    console.info(
      JSON.stringify({
        level: "warn",
        category: "session",
        event: "route access denied",
        pathname,
        reason: "role_mismatch",
        role: session.role,
        required: "super_admin",
      }),
    );
    return NextResponse.redirect(new URL(roleHome(session.role), request.url));
  }

  if (
    pathname.startsWith("/institute") &&
    session.role !== "institute_admin" &&
    session.role !== "teacher"
  ) {
    console.info(
      JSON.stringify({
        level: "warn",
        category: "session",
        event: "route access denied",
        pathname,
        reason: "role_mismatch",
        role: session.role,
      }),
    );
    return NextResponse.redirect(new URL(roleHome(session.role), request.url));
  }

  if (
    pathname.startsWith("/institute") &&
    session.role !== "super_admin" &&
    !session.instituteId
  ) {
    console.info(
      JSON.stringify({
        level: "warn",
        category: "session",
        event: "route access denied",
        pathname,
        reason: "missing_institute_context",
        userId: session.userId,
      }),
    );
    const res = NextResponse.redirect(new URL("/institute/login", request.url));
    res.cookies.set(WORKSPACE_SESSION_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  }

  if (pathname.startsWith("/student") && session.role !== "student") {
    console.info(
      JSON.stringify({
        level: "warn",
        category: "session",
        event: "route access denied",
        pathname,
        reason: "role_mismatch",
        role: session.role,
      }),
    );
    return NextResponse.redirect(new URL(roleHome(session.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/platform/:path*", "/institute/:path*", "/student/:path*"],
};
