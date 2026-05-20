import { redirect } from "next/navigation";
import { ROLE_HOME } from "@/lib/access-control";
import {
  logRouteAccessDenied,
  logTenantMismatch,
  readVerifiedWorkspaceSession,
} from "@/lib/workspace-session-server";
import type { UserRole, WorkspaceSession } from "@/types/access-control";

async function readServerSession(): Promise<WorkspaceSession | null> {
  return readVerifiedWorkspaceSession();
}

export async function requireAuth(layer: "platform" | "institute" | "student") {
  const session = await readServerSession();
  if (session) return session;
  logRouteAccessDenied(`/${layer}`, "unauthenticated");
  if (layer === "platform") redirect("/platform/login");
  if (layer === "institute") redirect("/institute/login");
  redirect("/student/login");
}

export async function requireRole(allowedRoles: UserRole[]) {
  const session = await readServerSession();
  if (!session) {
    logRouteAccessDenied("server", "unauthenticated", { allowedRoles });
    if (allowedRoles.includes("super_admin")) redirect("/platform/login");
    if (allowedRoles.includes("institute_admin") || allowedRoles.includes("teacher")) {
      redirect("/institute/login");
    }
    redirect("/student/login");
  }
  if (!allowedRoles.includes(session.role)) {
    logRouteAccessDenied("server", "role_not_allowed", {
      role: session.role,
      allowedRoles,
    });
    redirect(ROLE_HOME[session.role]);
  }
  return session;
}

export async function requireInstituteAccess() {
  const session = await readServerSession();
  if (!session) {
    logRouteAccessDenied("institute", "unauthenticated");
    redirect("/institute/login");
  }
  if (session.role === "super_admin") return session;
  if (!session.instituteId) {
    logRouteAccessDenied("institute", "missing_institute_id", {
      userId: session.userId,
      role: session.role,
    });
    redirect("/institute/login");
  }
  return session;
}

export async function assertInstituteTenant(
  resourceInstituteId: string | undefined,
  session: WorkspaceSession,
): Promise<void> {
  if (session.role === "super_admin") return;
  if (resourceInstituteId && resourceInstituteId !== session.instituteId) {
    logTenantMismatch(session.instituteId, resourceInstituteId, session.userId);
    redirect(ROLE_HOME[session.role]);
  }
}
