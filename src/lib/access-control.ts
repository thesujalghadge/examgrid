import type { UserRole } from "@/types/access-control";

export const ROLE_HOME: Record<UserRole, string> = {
  platform_admin: "/platform",
  institute: "/institute",
  student: "/student/tests",
  parent: "/parent",
};

export const ROLE_LOGIN: Record<UserRole, string> = {
  platform_admin: "/platform/login",
  institute: "/institute/login",
  student: "/student/login",
  parent: "/parent/login",
};

export function isInstituteScopedRole(role: UserRole | undefined): boolean {
  return role === "institute" || role === "student" || role === "parent";
}

export function isInstituteStaffRole(role: UserRole | undefined): boolean {
  return role === "institute";
}
