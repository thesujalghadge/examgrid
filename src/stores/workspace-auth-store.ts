"use client";

import { create } from "zustand";
import {
  clearWorkspaceSessionRemote,
  hydrateSessionFromServer,
  persistWorkspaceSessionRemote,
} from "@/lib/workspace-session";
import { isInstituteScopedRole } from "@/lib/access-control";
import { createSessionExpiry, isSessionExpired } from "@/lib/session-crypto";
import { logSessionEvent, logSessionWarning } from "@/lib/logging/runtime-logger";
import type { WorkspaceSession } from "@/types/access-control";
import type { UserRole } from "@/types/access-control";

interface WorkspaceAuthState {
  session: WorkspaceSession | null;
  isHydrated: boolean;
  hydrateSession: () => Promise<void>;
  /** @deprecated use hydrateSession */
  hydrate: () => void;
  getSession: () => WorkspaceSession | null;
  isAuthenticated: () => boolean;
  hasRole: (role: UserRole) => boolean;
  requireRole: (role: UserRole) => boolean;
  requireInstitute: () => boolean;
  login: (input: {
    userId: string;
    role: WorkspaceSession["role"];
    password: string;
    instituteId?: string;
  }) => Promise<boolean>;
  touch: () => Promise<void>;
  logout: () => Promise<void>;
  checkExpiry: () => boolean;
}

let expiryTimer: ReturnType<typeof setInterval> | null = null;

function startExpiryWatcher(onExpire: () => void) {
  if (expiryTimer) clearInterval(expiryTimer);
  expiryTimer = setInterval(() => {
    const session = useWorkspaceAuthStore.getState().session;
    if (session && isSessionExpired(session)) {
      logSessionWarning("workspace session expired — auto logout");
      void onExpire();
    }
  }, 30_000);
}

export const useWorkspaceAuthStore = create<WorkspaceAuthState>((set, get) => ({
  session: null,
  isHydrated: false,

  hydrateSession: async () => {
    if (typeof window === "undefined") {
      set({ isHydrated: true });
      return;
    }
    const session = await hydrateSessionFromServer();
    set({ session, isHydrated: true });
    if (session) {
      startExpiryWatcher(() => {
        void get().logout();
      });
    }
  },

  hydrate: () => {
    void get().hydrateSession();
  },

  getSession: () => get().session,
  isAuthenticated: () => Boolean(get().session),
  hasRole: (role) => get().session?.role === role,
  requireRole: (role) => get().session?.role === role,
  requireInstitute: () => Boolean(get().session?.instituteId),

  checkExpiry: () => {
    const session = get().session;
    if (!session) return false;
    if (isSessionExpired(session)) {
      void get().logout();
      return true;
    }
    return false;
  },

  login: async ({ userId, role, password, instituteId }) => {
    void password;
    if (!userId.trim()) return false;
    if (isInstituteScopedRole(role) && !instituteId?.trim()) return false;

    const ok = await persistWorkspaceSessionRemote({
      userId: userId.trim(),
      role,
      instituteId: instituteId?.trim() || undefined,
      expiresAt: createSessionExpiry(),
    });
    if (!ok) return false;

    const session = await hydrateSessionFromServer();
    set({ session });
    logSessionEvent("client login succeeded", { role, userId: userId.trim() });
    startExpiryWatcher(() => {
      void get().logout();
    });
    return true;
  },

  touch: async () => {
    try {
      const res = await fetch("/api/workspace/session", {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { session: WorkspaceSession };
      set({ session: data.session });
    } catch {
      logSessionWarning("session touch failed");
    }
  },

  logout: async () => {
    await clearWorkspaceSessionRemote();
    set({ session: null });
    if (expiryTimer) {
      clearInterval(expiryTimer);
      expiryTimer = null;
    }
  },
}));
