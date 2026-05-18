"use client";

import { Button } from "@/components/ui/button";
import { useQuestionStore } from "@/stores/question-store";
import { Eraser, ArrowLeft, ArrowRight, SaveAll, BookmarkPlus, Send } from "lucide-react";

interface QuestionNavigatorProps {
  onSubmitClick: () => void;
}

export function QuestionNavigator({ onSubmitClick }: QuestionNavigatorProps) {
  const exam = useQuestionStore((s) => s.exam);
  const currentQuestionId = useQuestionStore((s) => s.currentQuestionId);
  const clearResponse = useQuestionStore((s) => s.clearResponse);
  const saveAndNext = useQuestionStore((s) => s.saveAndNext);
  const markForReviewAndNext = useQuestionStore((s) => s.markForReviewAndNext);
  const goPrevious = useQuestionStore((s) => s.goPrevious);
  const goNext = useQuestionStore((s) => s.goNext);

  const allIds = exam
    ? exam.sections.flatMap((s) => s.questionIds)
    : [];
  const idx = currentQuestionId ? allIds.indexOf(currentQuestionId) : -1;
  const isFirst = idx <= 0;
  const isLast = idx >= allIds.length - 1;

  return (
    <div className="border-t border-border bg-background px-3 py-3 md:px-6 shadow-[0_-4px_10px_rgba(0,0,0,0.02)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        
        {/* Mobile: Top Row Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-start">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-10 px-3 font-medium shadow-sm flex-1 sm:flex-none justify-center gap-1.5 active:scale-[0.98]"
            disabled={!currentQuestionId}
            onClick={() => currentQuestionId && clearResponse(currentQuestionId)}
          >
            <Eraser className="h-4 w-4" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
          
          <div className="flex gap-2 flex-1 sm:flex-none">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-10 px-3 font-medium flex-1 sm:flex-none justify-center gap-1.5 active:scale-[0.98]"
              disabled={isFirst}
              onClick={goPrevious}
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden lg:inline">Prev</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-10 px-3 font-medium flex-1 sm:flex-none justify-center gap-1.5 active:scale-[0.98]"
              disabled={isLast}
              onClick={goNext}
            >
              <span className="hidden lg:inline">Next</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Primary State Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-10 flex-1 sm:flex-none bg-[#f59e0b] px-4 font-semibold text-amber-950 shadow-sm hover:bg-[#d97706] gap-1.5 active:scale-[0.98] transition-all"
            onClick={markForReviewAndNext}
          >
            <BookmarkPlus className="h-4 w-4" />
            <span className="truncate">Review & Next</span>
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-10 flex-1 sm:flex-none bg-emerald-600 px-4 font-semibold text-white shadow-sm hover:bg-emerald-700 gap-1.5 active:scale-[0.98] transition-all"
            onClick={saveAndNext}
          >
            <SaveAll className="h-4 w-4" />
            <span className="truncate">Save & Next</span>
          </Button>
          
          {/* Submit usually hidden in real CBT unless on last question, but keeping it visible as per old layout */}
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="h-10 px-4 font-bold shadow-sm gap-1.5 active:scale-[0.98] hidden lg:flex"
            onClick={onSubmitClick}
          >
            <Send className="h-4 w-4" />
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}
