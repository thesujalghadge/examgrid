"use client";

import { cn } from "@/lib/utils";
import { useQuestionStore } from "@/stores/question-store";

export function SectionTabs() {
  const exam = useQuestionStore((s) => s.exam);
  const currentSectionId = useQuestionStore((s) => s.currentSectionId);
  const switchSection = useQuestionStore((s) => s.switchSection);

  if (!exam) return null;

  return (
    <nav
      className="flex border-b-2 border-[#1a3c6e]/20 bg-[#dce4ef]"
      aria-label="Exam sections"
    >
      {exam.sections.map((section) => {
        const isActive = section.id === currentSectionId;
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => switchSection(section.id)}
            className={cn(
              "min-w-[160px] border-r border-[#1a3c6e]/15 px-8 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors",
              isActive
                ? "bg-white text-[#1a3c6e] shadow-[inset_0_-3px_0_0_#1a3c6e]"
                : "text-gray-700 hover:bg-white/70",
            )}
            aria-current={isActive ? "true" : undefined}
          >
            {section.name}
          </button>
        );
      })}
    </nav>
  );
}
