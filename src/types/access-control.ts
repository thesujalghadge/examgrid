export type UserRole =
  | "platform_admin"
  | "institute"
  | "parent"
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
