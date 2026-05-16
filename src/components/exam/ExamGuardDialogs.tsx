"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { UseExamGuardResult } from "@/hooks/useExamGuard";

interface ExamGuardDialogsProps {
  guard: Pick<
    UseExamGuardResult,
    | "showLeaveModal"
    | "showFullscreenWarning"
    | "violationMessage"
    | "violationCount"
    | "dismissLeaveModal"
    | "confirmLeave"
    | "dismissFullscreenWarning"
    | "reEnterFullscreen"
    | "clearViolationMessage"
  >;
}

export function ExamGuardDialogs({ guard }: ExamGuardDialogsProps) {
  return (
    <>
      <Dialog open={guard.showLeaveModal} onOpenChange={guard.dismissLeaveModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave examination?</DialogTitle>
            <DialogDescription>
              Browser back was detected during your active exam. Your timer
              continues running and progress is auto-saved. Stay on this page to
              continue your attempt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={guard.dismissLeaveModal}>
              Stay in Exam
            </Button>
            <Button variant="destructive" onClick={guard.confirmLeave}>
              Leave Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={guard.showFullscreenWarning}
        onOpenChange={guard.dismissFullscreenWarning}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fullscreen exited</DialogTitle>
            <DialogDescription>
              You have exited fullscreen mode. This violation has been recorded.
              Please return to fullscreen to continue the examination normally.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={guard.dismissFullscreenWarning}>
              Continue (recorded)
            </Button>
            <Button
              className="bg-[#1a3c6e] hover:bg-[#152d52]"
              onClick={() => void guard.reEnterFullscreen()}
            >
              Re-enter Fullscreen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {guard.violationMessage && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] w-full max-w-lg -translate-x-1/2 px-4">
          <Alert className="pointer-events-auto border-amber-400 bg-amber-50 shadow-lg">
            <AlertTitle className="text-amber-900">Exam integrity alert</AlertTitle>
            <AlertDescription className="flex items-center justify-between gap-2 text-amber-900">
              <span>{guard.violationMessage}</span>
              <button
                type="button"
                className="shrink-0 text-xs underline"
                onClick={guard.clearViolationMessage}
              >
                Dismiss
              </button>
            </AlertDescription>
            {guard.violationCount > 0 && (
              <p className="mt-1 text-xs text-amber-800">
                Total violations recorded: {guard.violationCount}
              </p>
            )}
          </Alert>
        </div>
      )}
    </>
  );
}
