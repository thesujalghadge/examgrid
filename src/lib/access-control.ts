import type { UserRole } from "@/types/access-control";

export const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/platform",
  institute_admin: "/institute/dashboard",
  teacher: "/institute/dashboard",
  student: "/student/dashboard",
};

const LAYER_ROLES: Record<"platform" | "institute" | "student", UserRole[]> = {
  platform: ["super_admin"],
  institute: ["institute_admin", "teacher"],
  student: ["student"],
};

export function canAccessLayer(
  layer: "platform" | "institute" | "student",
  role: UserRole | null,
) {
  if (!role) return false;
  return LAYER_ROLES[layer].includes(role);
}
