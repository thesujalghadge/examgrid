export type AuditActorRole = "admin" | "student" | "system";

export type AuditOutcome = "success" | "failure" | "blocked" | "warning";

export type AuditActionType =
  | "admin_login"
  | "admin_logout"
  | "student_login"
  | "student_logout"
  | "exam_create"
  | "exam_delete"
  | "schedule_create"
  | "schedule_edit"
  | "student_create"
  | "student_edit"
  | "student_deactivate"
  | "student_import"
  | "batch_create"
  | "batch_edit"
  | "batch_archive"
  | "exam_start"
  | "exam_submit"
  | "fullscreen_violation"
  | "tab_switch_violation"
  | "window_blur_violation"
  | "browser_back_violation"
  | "session_start"
  | "session_end"
  | "session_expired"
  | "operation_blocked";

export interface AuditLogEntry {
  eventId: string;
  actorId: string;
  actorRole: AuditActorRole;
  actionType: AuditActionType;
  resourceType: string;
  resourceId: string;
  timestampUTC: string;
  sessionId: string;
  source: string;
  metadata: Record<string, unknown>;
  outcome: AuditOutcome;
}

export interface AuditLogQuery {
  search?: string;
  actorId?: string;
  actionType?: string;
  resourceType?: string;
  startUTC?: string;
  endUTC?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditLogPage {
  rows: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}
