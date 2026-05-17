import { create } from "zustand";
import { STORAGE_KEYS } from "@/repositories/storage-keys";
import {
  appendSessionMetric,
  clearSessionId,
  getOrCreateSessionId,
  recordAuditEvent,
} from "@/services/audit-service";

export interface AdminUser {
  email: string;
  name: string;
  sessionStartedAtUTC: string;
  lastActivityAtUTC: string;
}

interface AdminAuthState {
  admin: AdminUser | null;
  isHydrated: boolean;
  hydrate: () => void;
  login: (email: string, password: string) => boolean;
  touch: () => void;
  logout: () => void;
  expire: (reason: string) => void;
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  admin: null,
  isHydrated: false,

  hydrate: () => {
    if (typeof window === "undefined") {
      set({ isHydrated: true });
      return;
    }
    const raw = sessionStorage.getItem(STORAGE_KEYS.adminSession);
    if (!raw) {
      set({ admin: null, isHydrated: true });
      return;
    }
    try {
      set({ admin: JSON.parse(raw) as AdminUser, isHydrated: true });
    } catch {
      set({ admin: null, isHydrated: true });
    }
  },

  login: (email, password) => {
    if (!email.trim() || password.length < 4) return false;
    const admin: AdminUser = {
      email: email.trim(),
      name: email.split("@")[0] || "Admin",
      sessionStartedAtUTC: new Date().toISOString(),
      lastActivityAtUTC: new Date().toISOString(),
    };
    const sessionId = getOrCreateSessionId();
    sessionStorage.setItem(STORAGE_KEYS.adminSession, JSON.stringify(admin));
    set({ admin });
    appendSessionMetric({
      sessionId,
      actorId: admin.email,
      actorRole: "admin",
      startedAtUTC: admin.sessionStartedAtUTC,
    });
    recordAuditEvent({
      actorId: admin.email,
      actorRole: "admin",
      actionType: "admin_login",
      resourceType: "session",
      resourceId: sessionId,
      metadata: { name: admin.name },
    });
    return true;
  },

  touch: () => {
    set((state) => {
      if (!state.admin || typeof window === "undefined") return state;
      const admin = {
        ...state.admin,
        lastActivityAtUTC: new Date().toISOString(),
      };
      sessionStorage.setItem(STORAGE_KEYS.adminSession, JSON.stringify(admin));
      return { admin };
    });
  },

  logout: () => {
    const raw = sessionStorage.getItem(STORAGE_KEYS.adminSession);
    const admin = raw ? (JSON.parse(raw) as AdminUser) : null;
    const sessionId = getOrCreateSessionId();
    if (admin) {
      recordAuditEvent({
        actorId: admin.email,
        actorRole: "admin",
        actionType: "admin_logout",
        resourceType: "session",
        resourceId: sessionId,
      });
      appendSessionMetric({
        sessionId,
        actorId: admin.email,
        actorRole: "admin",
        startedAtUTC: admin.sessionStartedAtUTC,
        endedAtUTC: new Date().toISOString(),
        reason: "logout",
      });
    }
    sessionStorage.removeItem(STORAGE_KEYS.adminSession);
    clearSessionId();
    set({ admin: null });
  },

  expire: (reason) => {
    const raw = sessionStorage.getItem(STORAGE_KEYS.adminSession);
    const admin = raw ? (JSON.parse(raw) as AdminUser) : null;
    const sessionId = getOrCreateSessionId();
    if (admin) {
      recordAuditEvent({
        actorId: admin.email,
        actorRole: "admin",
        actionType: "session_expired",
        resourceType: "session",
        resourceId: sessionId,
        metadata: { reason },
        outcome: "warning",
      });
      appendSessionMetric({
        sessionId,
        actorId: admin.email,
        actorRole: "admin",
        startedAtUTC: admin.sessionStartedAtUTC,
        endedAtUTC: new Date().toISOString(),
        reason,
      });
    }
    sessionStorage.removeItem(STORAGE_KEYS.adminSession);
    clearSessionId();
    set({ admin: null });
  },
}));
