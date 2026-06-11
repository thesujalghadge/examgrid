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
  submitState?: "idle" | "submitting" | "retrying" | "saved" | "failed";
  submitErrorText?: string | null;
}

export function SubmitModal({
  open,
  onOpenChange,
  onConfirm,
  submitState = "idle",
  submitErrorText,
}: SubmitModalProps) {
  const counts = useQuestionStore(selectPaletteCounts);
  const exam = useQuestionStore((s) => s.exam);
  const answered = counts.answered + counts.answeredAndMarked;
  const totalQuestions = exam?.totalQuestions ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Submit Examination</DialogTitle>
          <DialogDescription>
            Answered {answered} of {totalQuestions} questions. You will not be
            able to change your answers after submission.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded border border-gray-200 bg-gray-50 overflow-hidden text-sm max-w-full overflow-x-auto">
          <table className="w-full text-center">
            <thead className="bg-gray-100 text-xs font-semibold text-gray-700">
              <tr>
                <th className="px-3 py-2 text-left">Section</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2">Answered</th>
                <th className="px-2 py-2">Not Answered</th>
                <th className="px-2 py-2">Marked</th>
                <th className="px-2 py-2">Not Visited</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {exam?.sections.map((section) => {
                let sAns = 0;
                let sNotAns = 0;
                let sMarked = 0;
                let sNotVis = 0;
                const statuses = useQuestionStore.getState().questionStatuses;
                section.questionIds.forEach((id) => {
                  const s = statuses[id];
                  if (s === "answered" || s === "answered-and-marked") sAns++;
                  else if (s === "not-answered") sNotAns++;
                  else if (s === "marked-for-review") sMarked++;
                  else sNotVis++;
                });
                return (
                  <tr key={section.id}>
                    <td className="px-3 py-2 text-left font-medium truncate max-w-[100px]" title={section.name}>{section.name}</td>
                    <td className="px-2 py-2">{section.questionIds.length}</td>
                    <td className="px-2 py-2 text-green-600 font-medium">{sAns}</td>
                    <td className="px-2 py-2 text-red-500 font-medium">{sNotAns}</td>
                    <td className="px-2 py-2 text-purple-600 font-medium">{sMarked}</td>
                    <td className="px-2 py-2 text-gray-400">{sNotVis}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-gray-50 font-bold divide-y divide-gray-200">
              <tr>
                <td className="px-3 py-2 text-left">Total</td>
                <td className="px-2 py-2">{totalQuestions}</td>
                <td className="px-2 py-2 text-green-600">{counts.answered + counts.answeredAndMarked}</td>
                <td className="px-2 py-2 text-red-500">{counts.notAnswered}</td>
                <td className="px-2 py-2 text-purple-600">{counts.markedForReview}</td>
                <td className="px-2 py-2 text-gray-400">{counts.notVisited}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4">
          {submitErrorText ? (
            <div className="flex-1 text-left text-sm text-red-600 self-center">
              Error: {submitErrorText}
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={submitState !== "idle" && submitState !== "failed"}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button 
            type="button" 
            variant="destructive" 
            disabled={submitState !== "idle" && submitState !== "failed"} 
            onClick={onConfirm}
          >
            {submitState === "submitting" ? "Submitting..." : 
             submitState === "retrying" ? "Retrying..." : 
             submitState === "saved" ? "Saved!" : 
             "Yes, Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
