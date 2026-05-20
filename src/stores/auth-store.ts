import { create } from "zustand";
import type { Candidate } from "@/types/exam";
import { clearWorkspaceSession } from "@/lib/workspace-session";
import { clearSession, loadSession, saveSession } from "@/lib/persistence";
import {
  appendSessionMetric,
  clearSessionId,
  getOrCreateSessionId,
  recordAuditEvent,
} from "@/services/audit-service";

interface CandidateSession {
  candidate: Candidate;
  sessionStartedAtUTC: string;
  lastActivityAtUTC: string;
}

interface AuthState {
  candidate: Candidate | null;
  isHydrated: boolean;
  hydrate: () => void;
  login: (candidate: Candidate) => void;
  touch: () => void;
  logout: () => void;
  expire: (reason: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  candidate: null,
  isHydrated: false,

  hydrate: () => {
    const session = loadSession<CandidateSession>();
    set({
      candidate: session?.candidate ?? null,
      isHydrated: true,
    });
  },

  login: (candidate) => {
    const sessionId = getOrCreateSessionId();
    const session = {
      candidate,
      sessionStartedAtUTC: new Date().toISOString(),
      lastActivityAtUTC: new Date().toISOString(),
    };
    saveSession(session);
    set({ candidate });
    appendSessionMetric({
      sessionId,
      actorId: candidate.rollNumber,
      actorRole: "student",
      startedAtUTC: session.sessionStartedAtUTC,
    });
    recordAuditEvent({
      actorId: candidate.rollNumber,
      actorRole: "student",
      actionType: "student_login",
      resourceType: "session",
      resourceId: sessionId,
      metadata: { name: candidate.name, batchId: candidate.batchId },
    });
  },

  touch: () => {
    const session = loadSession<CandidateSession>();
    if (!session) return;
    saveSession({
      ...session,
      lastActivityAtUTC: new Date().toISOString(),
    });
  },

  logout: () => {
    const session = loadSession<CandidateSession>();
    const sessionId = getOrCreateSessionId();
    if (session) {
      recordAuditEvent({
        actorId: session.candidate.rollNumber,
        actorRole: "student",
        actionType: "student_logout",
        resourceType: "session",
        resourceId: sessionId,
      });
      appendSessionMetric({
        sessionId,
        actorId: session.candidate.rollNumber,
        actorRole: "student",
        startedAtUTC: session.sessionStartedAtUTC,
        endedAtUTC: new Date().toISOString(),
        reason: "logout",
      });
    }
    clearSession();
    clearWorkspaceSession();
    clearSessionId();
    set({ candidate: null });
  },

  expire: (reason) => {
    const session = loadSession<CandidateSession>();
    const sessionId = getOrCreateSessionId();
    if (session) {
      recordAuditEvent({
        actorId: session.candidate.rollNumber,
        actorRole: "student",
        actionType: "session_expired",
        resourceType: "session",
        resourceId: sessionId,
        metadata: { reason },
        outcome: "warning",
      });
      appendSessionMetric({
        sessionId,
        actorId: session.candidate.rollNumber,
        actorRole: "student",
        startedAtUTC: session.sessionStartedAtUTC,
        endedAtUTC: new Date().toISOString(),
        reason,
      });
    }
    clearSession();
    clearWorkspaceSession();
    clearSessionId();
    set({ candidate: null });
  },
}));
