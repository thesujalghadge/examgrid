"use client";

import { cn } from "@/lib/utils";
import { getPaletteButtonClass, PALETTE_LEGEND } from "@/lib/palette-styles";
import { useQuestionStore } from "@/stores/question-store";
interface QuestionPaletteProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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

  if (!exam || collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleCollapse}
        className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-l bg-[#1a3c6e] px-1 py-6 text-xs text-white shadow-md"
        aria-label="Show question palette"
      >
        ◀
      </button>
    );
  }

  const section = exam.sections.find((s) => s.id === currentSectionId);

  return (
    <>
      <button
        type="button"
        aria-label="Hide question palette"
        className="absolute inset-0 z-10 bg-black/20 md:hidden"
        onClick={onToggleCollapse}
      />
      <aside className="absolute inset-y-0 right-0 z-20 flex w-[min(280px,86vw)] shrink-0 flex-col bg-blue-50/30 md:static md:w-[300px]">
      <div className="flex items-center justify-between border-b border-gray-300 bg-[#1a3c6e] px-3 py-2 text-white">
        <h2 className="text-sm font-semibold tracking-wide">Question Palette</h2>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-xs hover:underline"
        >
          Hide ▶
        </button>
      </div>

      <div className="border-b border-gray-300 bg-white px-3 py-2 text-[11px]">
        <p className="mb-1.5 font-semibold text-gray-800">Legend</p>
        <ul className="space-y-1">
          {PALETTE_LEGEND.map((item, index) => (
            <li key={`legend-${item.status ?? "nat"}-${index}`} className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-block h-4 w-4 shrink-0 rounded-sm",
                  item.className,
                )}
              />
              <span className="text-gray-700">{item.label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {exam.sections.map((sec) => (
          <div key={sec.id} className="mb-3">
            <p className="mb-1.5 border-b border-gray-300 pb-1 text-[11px] font-bold uppercase tracking-wider text-[#1a3c6e]">
              {sec.name}
            </p>
            <div className="grid grid-cols-5 gap-1">
              {sec.questionIds.map((qId, idx) => {
                const status = questionStatuses[qId] ?? "not-visited";
                const isActive = qId === currentQuestionId;
                const isNumerical = exam.questions[qId]?.type === "NUMERICAL";
                return (
                  <button
                    key={qId}
                    type="button"
                    onClick={() => goToQuestion(qId)}
                    className={cn(
                      "relative flex h-8 w-8 items-center justify-center rounded-sm text-xs font-bold",
                      getPaletteButtonClass(status),
                      isActive &&
                        "ring-2 ring-[#1a3c6e] ring-offset-1 ring-offset-white",
                    )}
                    aria-label={`Question ${idx + 1}, ${status}`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {idx + 1}
                    {isNumerical && (
                      <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-orange-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {section && (
        <div className="border-t border-gray-300 bg-white px-3 py-2 text-[11px] text-gray-600">
          <p>
            Current section: <strong>{section.name}</strong>
          </p>
        </div>
      )}
      </aside>
    </>
  );
}
