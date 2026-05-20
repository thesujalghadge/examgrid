export type UserRole =
  | "super_admin"
  | "institute_admin"
  | "teacher"
  | "student";

export interface TenantContext {
  instituteId: string | null;
  instituteName?: string;
}

export interface WorkspaceSession {
  userId: string;
  role: UserRole;
  instituteId?: string;
  /** Unix ms — enforced in middleware + client */
  expiresAt: number;
}
