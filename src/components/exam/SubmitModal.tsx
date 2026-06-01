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
import {
  selectPaletteCounts,
  useQuestionStore,
} from "@/stores/question-store";

interface SubmitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function SubmitModal({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting = false,
}: SubmitModalProps) {
  const counts = useQuestionStore(selectPaletteCounts);
  const exam = useQuestionStore((s) => s.exam);
  const answered = counts.answered + counts.answeredAndMarked;
  const totalQuestions = exam?.totalQuestions ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Examination</DialogTitle>
          <DialogDescription>
            Answered {answered} of {totalQuestions} questions. You will not be
            able to change your answers after submission.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border border-gray-200 bg-gray-50 p-4 text-sm">
          <p className="mb-2 font-semibold">Summary</p>
          <ul className="space-y-1 text-gray-700">
            <li>Answered: {counts.answered + counts.answeredAndMarked}</li>
            <li>Not Answered (visited): {counts.notAnswered}</li>
            <li>Not Visited: {counts.notVisited}</li>
            <li>
              Marked for Review:{" "}
              {counts.markedForReview + counts.answeredAndMarked}
            </li>
          </ul>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={isSubmitting} onClick={onConfirm}>
            {isSubmitting ? "Submitting..." : "Yes, Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
