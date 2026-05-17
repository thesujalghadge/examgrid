"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isFullscreenActive } from "@/lib/fullscreen";
import { recordAuditEvent } from "@/services/audit-service";
import { useExamSessionStore } from "@/stores/exam-session-store";
import type { AuditActorRole } from "@/types/audit";

export interface UseExamGuardOptions {
  enabled: boolean;
  onPersist?: () => void;
  auditContext?: {
    actorId: string;
    actorRole: AuditActorRole;
    examId: string;
  };
}

export interface UseExamGuardResult {
  showLeaveModal: boolean;
  showFullscreenWarning: boolean;
  violationMessage: string | null;
  violationCount: number;
  dismissLeaveModal: () => void;
  confirmLeave: () => void;
  dismissFullscreenWarning: () => void;
  reEnterFullscreen: () => Promise<void>;
  clearViolationMessage: () => void;
}

export function useExamGuard({
  enabled,
  onPersist,
  auditContext,
}: UseExamGuardOptions): UseExamGuardResult {
  const violations = useExamSessionStore((s) => s.violations);
  const lastViolationMessage = useExamSessionStore((s) => s.lastViolationMessage);
  const recordViolation = useExamSessionStore((s) => s.recordViolation);
  const clearLastMessage = useExamSessionStore((s) => s.clearLastMessage);

  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showFullscreenWarning, setShowFullscreenWarning] = useState(false);
  const leaveConfirmedRef = useRef(false);
  const guardPushedRef = useRef(false);
  const blurCooldownRef = useRef(0);

  const dismissLeaveModal = useCallback(() => {
    setShowLeaveModal(false);
  }, []);

  const confirmLeave = useCallback(() => {
    leaveConfirmedRef.current = true;
    setShowLeaveModal(false);
  }, []);

  const dismissFullscreenWarning = useCallback(() => {
    setShowFullscreenWarning(false);
  }, []);

  const reEnterFullscreen = useCallback(async () => {
    const { requestExamFullscreen } = await import("@/lib/fullscreen");
    await requestExamFullscreen();
    setShowFullscreenWarning(false);
  }, []);

  const recordWithPersist = useCallback(
    (type: Parameters<typeof recordViolation>[0]) => {
      const violation = recordViolation(type);
      if (auditContext) {
        recordAuditEvent({
          actorId: auditContext.actorId,
          actorRole: auditContext.actorRole,
          actionType:
            type === "fullscreen_exit"
              ? "fullscreen_violation"
              : type === "tab_switch"
                ? "tab_switch_violation"
                : type === "window_blur"
                  ? "window_blur_violation"
                  : "browser_back_violation",
          resourceType: "exam",
          resourceId: auditContext.examId,
          metadata: { violationId: violation.id, type },
          outcome: "warning",
        });
      }
      onPersist?.();
    },
    [auditContext, recordViolation, onPersist],
  );

  useEffect(() => {
    if (!enabled) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leaveConfirmedRef.current) return;
      e.preventDefault();
      e.returnValue =
        "Your exam is in progress. Leaving may interrupt your attempt.";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    if (!guardPushedRef.current) {
      window.history.pushState({ examGuard: true }, "", window.location.href);
      guardPushedRef.current = true;
    }

    const handlePopState = () => {
      window.history.pushState({ examGuard: true }, "", window.location.href);
      recordWithPersist("browser_back");
      setShowLeaveModal(true);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enabled, recordWithPersist]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        recordWithPersist("tab_switch");
      }
    };

    const handleBlur = () => {
      const now = Date.now();
      if (now - blurCooldownRef.current < 800) return;
      blurCooldownRef.current = now;
      if (document.visibilityState === "visible") {
        recordWithPersist("window_blur");
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("blur", handleBlur);
    };
  }, [enabled, recordWithPersist]);

  useEffect(() => {
    if (!enabled) return;

    const handleFullscreenChange = () => {
      if (!isFullscreenActive()) {
        recordWithPersist("fullscreen_exit");
        setShowFullscreenWarning(true);
      } else {
        setShowFullscreenWarning(false);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, [enabled, recordWithPersist]);

  useEffect(() => {
    if (!enabled || lastViolationMessage == null) return;
    const t = window.setTimeout(() => clearLastMessage(), 6000);
    return () => window.clearTimeout(t);
  }, [enabled, lastViolationMessage, clearLastMessage]);

  return {
    showLeaveModal,
    showFullscreenWarning,
    violationMessage: lastViolationMessage,
    violationCount: violations.length,
    dismissLeaveModal,
    confirmLeave,
    dismissFullscreenWarning,
    reEnterFullscreen,
    clearViolationMessage: clearLastMessage,
  };
}
