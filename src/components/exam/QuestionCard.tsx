"use client";

import { stripLeadingQuestionNumber } from "@/lib/cbt/format-math";
import { cn } from "@/lib/utils";
import { useQuestionStore } from "@/stores/question-store";
import { MathRenderer } from "./MathRenderer";
import { NumericalAnswerInput } from "./NumericalAnswerInput";

interface QuestionCardReviewProps {
  issues?: string[];
  flagged?: boolean;
  onToggleFlag?: () => void;
  onQuestionTextChange?: (value: string) => void;
  onOptionTextChange?: (label: string, value: string) => void;
  onCorrectAnswerChange?: (value: string) => void;
  onMarksChange?: (value: string) => void;
  onNegativeMarksChange?: (value: string) => void;
}

interface QuestionCardProps {
  review?: QuestionCardReviewProps;
}

export function QuestionCard({ review }: QuestionCardProps) {
  const exam = useQuestionStore((s) => s.exam);
  const currentQuestionId = useQuestionStore((s) => s.currentQuestionId);
  const answers = useQuestionStore((s) => s.answers);
  const selectOption = useQuestionStore((s) => s.selectOption);
  const setNumericalAnswer = useQuestionStore((s) => s.setNumericalAnswer);
  const question = exam && currentQuestionId ? exam.questions[currentQuestionId] : undefined;
  const isTeacherEdit = Boolean(review);
  const displayQuestionText = question ? stripLeadingQuestionNumber(question.text) : "";

  if (!exam || !currentQuestionId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white text-gray-500">
        Loading question...
      </div>
    );
  }

  if (!question) return null;

  const section = exam.sections.find((s) => s.id === question.sectionId);
  const selected = answers[currentQuestionId] ?? "";
  const globalIndex = exam.sections.flatMap((s) => s.questionIds).indexOf(currentQuestionId) + 1;
  const isNumerical = question.type === "NUMERICAL";
  const options = question.options ?? [];
  const isLongQuestion = displayQuestionText.length > 300;
  const reviewCorrectValue = question.correctOptionId
    ? options.find((option) => option.id === question.correctOptionId)?.label ?? ""
    : question.correctNumericalAnswer ?? "";
  const hasIssues = (review?.issues?.length ?? 0) > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="border-b border-gray-200 bg-[#f8fafc] px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide",
                isNumerical
                  ? "border-orange-300 bg-orange-100 text-orange-700"
                  : "border-blue-300 bg-blue-100 text-blue-700",
              )}
            >
              {isNumerical ? "NAT" : "MCQ"}
            </span>
            <span className="text-sm font-semibold text-gray-700">
              Q{question.number}
            </span>
          </div>
          <span className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
            +{question.marks}
            {question.negativeMarks > 0 ? ` / -${question.negativeMarks}` : ""}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {section?.name} · Q{question.number} (#{globalIndex})
        </p>
      </div>

      <div className="px-3 py-4 md:px-8 md:py-7">
        
        {/* TEMPORARY RUNTIME DEBUG PANEL */}
        <div className="mb-6 rounded-md border-2 border-red-400 bg-red-50 p-4 font-mono text-[11px] leading-tight text-red-900 shadow-sm">
          <div className="mb-2 font-bold uppercase tracking-wider text-red-800 border-b border-red-200 pb-1">
            Pipeline Runtime Audit (Debug Mode)
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <p><span className="font-semibold">Source Adapter:</span> {(question as any)._debug_source || "legacy_visual_extractor"}</p>
              <p><span className="font-semibold">Detected Type:</span> {question.type}</p>
              <p><span className="font-semibold">Confidence:</span> {(question as any).confidence}</p>
            </div>
            <div>
              <p className="font-semibold mb-1">Mapped Asset Paths (Stem + Options):</p>
              <ul className="list-inside list-disc opacity-80">
                {((question as any)._debug_assets || []).map((path: string, i: number) => (
                  <li key={i}>{path}</li>
                ))}
                {!((question as any)._debug_assets || []).length && <li>No WebP assets attached.</li>}
              </ul>
            </div>
          </div>
        </div>

        <div className="mb-7 rounded-md border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-[#f8fafc] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#1a3c6e]">
            Question
          </div>
          <div className="flex items-start gap-3 px-4 py-4 text-[15px] leading-7 text-gray-950">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a3c6e] text-xs font-bold text-white">
              {question.number}
            </span>
            {question.stemImage ? (
              <img src={question.stemImage} alt="Question" className="max-w-full max-h-[600px] object-contain border border-gray-100 rounded shadow-sm" />
            ) : isTeacherEdit ? (
              <textarea
                className="min-h-[100px] w-full rounded-md border border-[#d7dde7] px-3 py-2 text-sm text-gray-900"
                value={question.text}
                onChange={(event) => review?.onQuestionTextChange?.(event.target.value)}
              />
            ) : (
              <div
                className={cn(
                  "whitespace-pre-wrap break-words",
                  isLongQuestion &&
                    "max-h-[40vh] overflow-y-auto rounded border border-gray-100 bg-gray-50 p-3",
                )}
              >
                <MathRenderer text={displayQuestionText} className="text-base leading-relaxed text-gray-800" />
              </div>
            )}
          </div>
          {question.images && question.images.length > 0 ? (
            <div className="mx-4 mb-4 space-y-3">
              {question.images.map((img, i) => (
                img.trim().startsWith("<svg") ? (
                  <div key={i} className="flex justify-center rounded-md border border-gray-200 bg-white p-4" dangerouslySetInnerHTML={{ __html: img }} />
                ) : img.trim().startsWith("/uploads") ? (
                  <img key={i} src={img} alt="Question Diagram" className="max-w-full max-h-[600px] object-contain border border-gray-100 rounded shadow-sm mx-auto" />
                ) : (
                  <div key={i} className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm italic text-gray-700">
                    {img}
                  </div>
                )
              ))}
            </div>
          ) : question.hasImage ? (
            <div className="mx-4 mb-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800">
              Diagram detected. Refer to the original PDF for the figure.
            </div>
          ) : null}
        </div>

        {isNumerical ? (
          isTeacherEdit ? (
            <div className="space-y-2 rounded-md border border-gray-200 p-4">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Correct answer (numerical)
              </label>
              <input
                className="w-full max-w-xs rounded-md border border-[#d7dde7] px-3 py-2 text-sm"
                value={reviewCorrectValue}
                onChange={(event) => review?.onCorrectAnswerChange?.(event.target.value)}
              />
            </div>
          ) : (
            <>
              <div className="mb-4 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-800">
                Integer / Numerical Type — Enter your answer using the keypad below.
              </div>
              <NumericalAnswerInput
                questionId={question.id}
                value={selected}
                onValueChange={setNumericalAnswer}
              />
            </>
          )
        ) : (
          <fieldset className="rounded-md border border-gray-200 p-4">
            <legend className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Options
            </legend>
            <ul className="space-y-3">
              {options.map((opt) => {
                const isSelected = isTeacherEdit
                  ? reviewCorrectValue === opt.label
                  : selected === opt.id;
                const displayOptionText = stripLeadingQuestionNumber(opt.text);
                return (
                  <li key={opt.id}>
                    <label
                      className={cn(
                        isTeacherEdit
                          ? "flex items-start gap-4 rounded-md border px-4 py-3.5 shadow-sm transition-colors"
                          : "flex w-full cursor-pointer items-center gap-3 rounded border-2 px-5 py-3 text-base font-medium transition-colors",
                        isTeacherEdit
                          ? "border-[#d7dde7] bg-white"
                          : isSelected
                            ? "border-[#1a3c6e] bg-[#1a3c6e] text-white"
                            : "border-gray-300 bg-white text-gray-900 hover:border-[#1a3c6e] hover:bg-[#f0f4fa]",
                        isTeacherEdit && isSelected && "border-[#1a3c6e] bg-[#eef3fa]",
                      )}
                      onClick={() => {
                        if (!isTeacherEdit) selectOption(question.id, opt.id);
                      }}
                    >
                      {isTeacherEdit && (
                        <input
                          type="radio"
                          name={question.id}
                          value={opt.id}
                          checked={isSelected}
                          onChange={() => review?.onCorrectAnswerChange?.(opt.label)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#1a3c6e]"
                        />
                      )}
                      <div
                        className={cn(
                          "flex flex-1 items-center gap-3 whitespace-pre-wrap break-words text-sm leading-6",
                          isSelected && !isTeacherEdit ? "text-white" : "text-gray-950",
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                            isSelected && !isTeacherEdit
                              ? "border-white bg-white text-[#1a3c6e]"
                              : "border-[#1a3c6e] bg-white text-[#1a3c6e]",
                          )}
                        >
                          {opt.label}
                        </span>
                        <div className="flex-1">
                          {opt.image ? (
                            <img src={opt.image} alt={opt.label} className="max-w-full max-h-[200px] object-contain border border-gray-100 rounded" />
                          ) : isTeacherEdit ? (
                            <input
                              className="w-full rounded-md border border-[#d7dde7] px-2 py-1 text-sm"
                              value={opt.text}
                              onChange={(event) => review?.onOptionTextChange?.(opt.label, event.target.value)}
                            />
                          ) : (
                            <MathRenderer text={displayOptionText} className="text-sm leading-6" />
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
            {options.length === 0 ? (
              <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                No options were detected for this MCQ. Please review the source paper.
              </p>
            ) : null}
            {isTeacherEdit && (
              <div className="mt-5 border-t border-gray-200 pt-4">
                <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                  Correct Answer:
                  <select
                    className="rounded-md border border-[#d7dde7] bg-white px-3 py-1.5 text-sm"
                    value={reviewCorrectValue}
                    onChange={(e) => review?.onCorrectAnswerChange?.(e.target.value)}
                  >
                    <option value="">Select option...</option>
                    {options.map((opt) => (
                      <option key={opt.id} value={opt.label}>
                        Option {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </fieldset>
        )}

        {/* Marks editing removed as per teacher UX update */}

        {hasIssues ? (
          <ul className="mt-4 space-y-1 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {review!.issues!.map((issue) => (
              <li key={issue}>• {issue}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
