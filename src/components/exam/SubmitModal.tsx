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
}

export function SubmitModal({
  open,
  onOpenChange,
  onConfirm,
}: SubmitModalProps) {
  const counts = useQuestionStore(selectPaletteCounts);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Submit Examination</DialogTitle>
          <DialogDescription>
            Are you sure you want to submit? You will not be able to change your
            answers after submission.
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
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm}>
            Yes, Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
