"use client";

import { cn } from "@/lib/utils";
import { getPaletteButtonClass, PALETTE_LEGEND } from "@/lib/palette-styles";
import { useQuestionStore } from "@/stores/question-store";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Fragment } from "react";

interface QuestionPaletteProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobile?: boolean; // deprecated prop
}

export function QuestionPalette({
  collapsed,
  onToggleCollapse,
}: QuestionPaletteProps) {
  const exam = useQuestionStore((s) => s.exam);
  const currentQuestionId = useQuestionStore((s) => s.currentQuestionId);
  const currentSectionId = useQuestionStore((s) => s.currentSectionId);
  const questionStatuses = useQuestionStore((s) => s.questionStatuses);
  const goToQuestion = useQuestionStore((s) => s.goToQuestion);

  if (!exam) return null;

  const section = exam.sections.find((s) => s.id === currentSectionId);

  const PaletteContent = (isMobileView: boolean) => (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-muted/30 px-4 md:h-16 md:bg-transparent">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Question Palette</h2>
        {isMobileView ? (
          <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="-mr-2 h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="-mr-2 h-8 w-8 hidden md:inline-flex">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:py-6">
        <div className="mb-6 rounded-lg border border-border bg-card p-3 shadow-sm">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Legend</p>
          <ul className="grid grid-cols-2 gap-y-2 gap-x-4 text-xs sm:grid-cols-1">
            {PALETTE_LEGEND.map((item) => (
              <li key={item.status} className="flex items-center gap-2">
                <span className={cn("inline-block h-3.5 w-3.5 shrink-0 rounded", item.className)} />
                <span className="text-muted-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-6">
          {exam.sections.map((sec) => (
            <div key={sec.id}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  {sec.name}
                </p>
                <span className="text-[10px] font-medium text-muted-foreground">{sec.questionIds.length} Qs</span>
              </div>
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6">
                {sec.questionIds.map((qId, idx) => {
                  const status = questionStatuses[qId] ?? "not-visited";
                  const isActive = qId === currentQuestionId;
                  return (
                    <button
                      key={qId}
                      type="button"
                      onClick={() => {
                        goToQuestion(qId);
                        if (isMobileView && onToggleCollapse) onToggleCollapse();
                      }}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-md text-xs font-semibold transition-all duration-200",
                        getPaletteButtonClass(status),
                        isActive && "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 shadow-sm"
                      )}
                      aria-label={`Question ${idx + 1}, ${status}`}
                      aria-current={isActive ? "true" : undefined}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {section && (
        <div className="border-t border-border bg-muted/10 px-4 py-3 text-xs text-muted-foreground">
          Section: <strong className="text-foreground">{section.name}</strong>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Drawer (visible only on mobile) */}
      <div className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-[280px] sm:w-[320px] flex-col bg-background shadow-2xl transition-transform duration-300 ease-in-out md:hidden",
        collapsed ? "translate-x-full" : "translate-x-0"
      )}>
        {PaletteContent(true)}
      </div>

      {/* Desktop Sidebar (visible only on md+) */}
      {collapsed ? (
        <div className="hidden md:flex h-full w-12 flex-col items-center border-l border-border bg-muted/20 py-4 z-10 relative">
          <Button variant="ghost" size="icon" onClick={onToggleCollapse} className="mb-4">
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <aside className="hidden w-[280px] shrink-0 flex-col border-l border-border bg-muted/10 md:flex xl:w-[320px] z-10 relative">
          {PaletteContent(false)}
        </aside>
      )}
    </>
  );
}
