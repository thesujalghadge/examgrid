"use client";

import { Label } from "@/components/ui/label";
import { JEE_SUBJECTS, rangesForLayout } from "@/lib/cbt/subject-mapping";
import type { PaperSubjectMapping, SubjectPaperLayout, SubjectRangeMapping } from "@/types/cbt-paper-processing";

interface ConductCbtSubjectPanelProps {
  /** Expected or parsed question count — used for range labels. */
  questionCount: number;
  mapping: PaperSubjectMapping;
  onChange: (mapping: PaperSubjectMapping) => void;
  compact?: boolean;
}

export function ConductCbtSubjectPanel({
  questionCount,
  mapping,
  onChange,
  compact = false,
}: ConductCbtSubjectPanelProps) {
  const total = Math.max(1, questionCount);

  const setLayout = (layout: SubjectPaperLayout) => {
    if (layout === "single") {
      onChange({
        layout: "single",
        mode: "single",
        singleSubject: mapping.singleSubject ?? "Physics",
        ranges: [{ start: 1, end: total, subject: mapping.singleSubject ?? "Physics" }],
      });
      return;
    }
    onChange({
      layout,
      mode: "multi",
      ranges: rangesForLayout(layout, total),
    });
  };

  const updateRange = (index: number, patch: Partial<SubjectRangeMapping>) => {
    const ranges = [...(mapping.ranges ?? [])];
    ranges[index] = { ...ranges[index], ...patch };
    onChange({ ...mapping, layout: mapping.layout, mode: "multi", ranges });
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4 rounded-xl border border-[#ece6da] bg-[#fbf9f4] p-4"}>
      {!compact ? (
        <div>
          <p className="font-medium text-[#14213d]">Subjects</p>
          <p className="mt-1 text-sm text-[#5e5a52]">
            Choose how subjects apply across questions. Tap a subject chip to assign a range.
          </p>
        </div>
      ) : (
        <Label>Subjects</Label>
      )}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "single" as const, label: "Single Subject" },
            { id: "two" as const, label: "Two Subjects" },
            { id: "full" as const, label: "Full Test" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setLayout(item.id)}
            className={
              mapping.layout === item.id
                ? "rounded-lg bg-[#14213d] px-4 py-2 text-sm font-medium text-white"
                : "rounded-lg border border-[#d8d2c7] bg-white px-4 py-2 text-sm text-[#14213d] hover:border-[#8a6f3e]"
            }
          >
            {item.label}
          </button>
        ))}
      </div>

      {mapping.layout === "single" ? (
        <div className="flex flex-wrap gap-2">
          {JEE_SUBJECTS.map((subject) => (
            <button
              key={subject}
              type="button"
              onClick={() =>
                onChange({
                  layout: "single",
                  mode: "single",
                  singleSubject: subject,
                  ranges: [{ start: 1, end: total, subject }],
                })
              }
              className={
                mapping.singleSubject === subject
                  ? "rounded-full bg-[#8a6f3e] px-4 py-1.5 text-sm font-medium text-white"
                  : "rounded-full border border-[#d8d2c7] bg-white px-4 py-1.5 text-sm text-[#14213d]"
              }
            >
              {subject}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(mapping.ranges ?? []).map((range, index) => (
            <div
              key={`${range.start}-${range.end}-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[#ece6da] bg-white px-3 py-2"
            >
              <span className="text-sm font-semibold text-[#14213d]">
                Q{range.start}–{range.end}
              </span>
              <input
                type="number"
                min={1}
                max={total}
                value={range.start}
                aria-label={`Range ${index + 1} start`}
                onChange={(event) => updateRange(index, { start: Number(event.target.value) || 1 })}
                className="w-14 rounded border border-[#d8d2c7] px-2 py-1 text-sm"
              />
              <span className="text-sm text-[#5e5a52]">to</span>
              <input
                type="number"
                min={1}
                max={total}
                value={range.end}
                aria-label={`Range ${index + 1} end`}
                onChange={(event) => updateRange(index, { end: Number(event.target.value) || 1 })}
                className="w-14 rounded border border-[#d8d2c7] px-2 py-1 text-sm"
              />
              <div className="flex flex-wrap gap-1">
                {JEE_SUBJECTS.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => updateRange(index, { subject })}
                    className={
                      range.subject === subject
                        ? "rounded-full bg-[#14213d] px-3 py-1 text-xs font-medium text-white"
                        : "rounded-full border border-[#d8d2c7] px-3 py-1 text-xs text-[#14213d]"
                    }
                  >
                    {subject}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
