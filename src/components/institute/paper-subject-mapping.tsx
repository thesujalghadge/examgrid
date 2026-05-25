"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { JEE_SUBJECTS, validateSubjectMapping } from "@/lib/cbt/subject-mapping";
import type { PaperSubjectMapping, SubjectRangeMapping } from "@/types/cbt-paper-processing";

function buildDefaultMultiRanges(totalQuestions: number): SubjectRangeMapping[] {
  if (totalQuestions <= 0) return [];
  const chunk = Math.max(1, Math.ceil(totalQuestions / 3));
  const ranges: SubjectRangeMapping[] = [
    { start: 1, end: Math.min(chunk, totalQuestions), subject: "Physics" },
    {
      start: Math.min(chunk + 1, totalQuestions),
      end: Math.min(chunk * 2, totalQuestions),
      subject: "Chemistry",
    },
    {
      start: Math.min(chunk * 2 + 1, totalQuestions),
      end: totalQuestions,
      subject: "Mathematics",
    },
  ];
  return ranges.filter((range) => range.start <= range.end);
}

interface PaperSubjectMappingPanelProps {
  totalQuestions: number;
  mapping: PaperSubjectMapping;
  onChange: (mapping: PaperSubjectMapping) => void;
}

export function PaperSubjectMappingPanel({
  totalQuestions,
  mapping,
  onChange,
}: PaperSubjectMappingPanelProps) {
  const issues = useMemo(
    () => validateSubjectMapping(totalQuestions, mapping),
    [mapping, totalQuestions],
  );

  const setMode = (mode: PaperSubjectMapping["mode"]) => {
    if (mode === "single") {
      onChange({
        mode: "single",
        singleSubject: mapping.singleSubject ?? JEE_SUBJECTS[0],
        ranges: [{ start: 1, end: Math.max(1, totalQuestions), subject: mapping.singleSubject ?? JEE_SUBJECTS[0] }],
      });
      return;
    }
    onChange({
      mode: "multi",
      ranges:
        mapping.ranges && mapping.ranges.length > 0
          ? mapping.ranges
          : buildDefaultMultiRanges(totalQuestions),
    });
  };

  const updateRange = (index: number, patch: Partial<SubjectRangeMapping>) => {
    const ranges = [...(mapping.ranges ?? [])];
    ranges[index] = { ...ranges[index], ...patch };
    onChange({ ...mapping, mode: "multi", ranges });
  };

  const addRange = () => {
    const ranges = [...(mapping.ranges ?? [])];
    const lastEnd = ranges.length > 0 ? ranges[ranges.length - 1].end : 0;
    const start = Math.min(totalQuestions, lastEnd + 1);
    const end = Math.min(totalQuestions, start + 9);
    ranges.push({ start, end: Math.max(start, end), subject: JEE_SUBJECTS[1] ?? "Chemistry" });
    onChange({ ...mapping, mode: "multi", ranges });
  };

  const removeRange = (index: number) => {
    const ranges = (mapping.ranges ?? []).filter((_, currentIndex) => currentIndex !== index);
    onChange({ ...mapping, mode: "multi", ranges });
  };

  return (
    <div className="space-y-4 rounded-xl border border-[#ece6da] bg-[#fbf9f4] p-4">
      <div>
        <p className="font-medium text-[#14213d]">Subject mapping</p>
        <p className="mt-1 text-sm text-[#5e5a52]">
          Assign subjects to parsed questions before preview. Use ranges for multi-subject JEE papers.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mapping.mode === "single" ? "default" : "outline"}
          className={mapping.mode === "single" ? "bg-[#14213d]" : ""}
          onClick={() => setMode("single")}
        >
          Single subject
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mapping.mode === "multi" ? "default" : "outline"}
          className={mapping.mode === "multi" ? "bg-[#14213d]" : ""}
          onClick={() => setMode("multi")}
        >
          Multi subject
        </Button>
      </div>

      {mapping.mode === "single" ? (
        <div className="space-y-2">
          <Label>Subject for all {totalQuestions} question(s)</Label>
          <div className="flex flex-wrap gap-2">
            {JEE_SUBJECTS.map((subject) => (
              <button
                key={subject}
                type="button"
                onClick={() =>
                  onChange({
                    mode: "single",
                    singleSubject: subject,
                    ranges: [{ start: 1, end: Math.max(1, totalQuestions), subject }],
                  })
                }
                className={
                  mapping.singleSubject === subject
                    ? "rounded-full bg-[#14213d] px-3 py-1.5 text-sm font-medium text-white"
                    : "rounded-full border border-[#d8d2c7] bg-white px-3 py-1.5 text-sm text-[#14213d] hover:border-[#8a6f3e]"
                }
              >
                {subject}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[#5e5a52]">
            Click a subject chip to set the range. Example: [1-10] Physics, [11-20] Chemistry.
          </p>
          {(mapping.ranges ?? []).map((range, index) => (
            <div
              key={`${range.start}-${range.end}-${index}`}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-[#ece6da] bg-white p-3"
            >
              <span className="text-sm font-medium text-[#14213d]">Q</span>
              <input
                type="number"
                min={1}
                max={totalQuestions}
                value={range.start}
                onChange={(event) =>
                  updateRange(index, { start: Number(event.target.value) || 1 })
                }
                className="w-16 rounded border border-[#d8d2c7] px-2 py-1 text-sm"
              />
              <span className="text-sm text-[#5e5a52]">to</span>
              <input
                type="number"
                min={1}
                max={totalQuestions}
                value={range.end}
                onChange={(event) =>
                  updateRange(index, { end: Number(event.target.value) || 1 })
                }
                className="w-16 rounded border border-[#d8d2c7] px-2 py-1 text-sm"
              />
              <div className="flex flex-wrap gap-1">
                {JEE_SUBJECTS.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onClick={() => updateRange(index, { subject })}
                    className={
                      range.subject === subject
                        ? "rounded-full bg-[#8a6f3e] px-2.5 py-1 text-xs font-medium text-white"
                        : "rounded-full border border-[#d8d2c7] px-2.5 py-1 text-xs text-[#14213d]"
                    }
                  >
                    {subject}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => removeRange(index)}
                disabled={(mapping.ranges?.length ?? 0) <= 1}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addRange}>
            Add range
          </Button>
        </div>
      )}

      {issues.length > 0 ? (
        <ul className="space-y-1 text-sm text-amber-800">
          {issues.map((issue) => (
            <li key={issue}>• {issue}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#2f6a37]">Subject mapping covers all parsed questions.</p>
      )}
    </div>
  );
}
