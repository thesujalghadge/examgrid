"use client";

import { stripLeadingQuestionNumber } from "@/lib/cbt/format-math";
import { cn } from "@/lib/utils";
import { useQuestionStore } from "@/stores/question-store";
import { MathRenderer } from "./MathRenderer";
import { NumericalAnswerInput } from "./NumericalAnswerInput";
import type { ExamOption } from "@/types/exam";

interface QuestionCardReviewProps {
  issues?: string[];
  flagged?: boolean;
  onToggleFlag?: () => void;
  onQuestionTextChange?: (value: string) => void;
  onOptionTextChange?: (label: string, value: string) => void;
  onCorrectAnswerChange?: (value: string) => void;
  onMarksChange?: (value: string) => void;
  onNegativeMarksChange?: (value: string) => void;
  onQuestionTypeChange?: (value: 'MCQ_SINGLE' | 'NUMERICAL') => void;
}

interface QuestionCardProps {
  review?: QuestionCardReviewProps;
}

export function QuestionCard({ review }: QuestionCardProps) {
  const exam = useQuestionStore((s) => s.exam);
  const currentQuestionId = useQuestionStore((s) => s.currentQuestionId);
  const draftAnswers = useQuestionStore((s) => s.draftAnswers);
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
  const selected = draftAnswers[currentQuestionId] ?? "";
  const globalIndex = exam.sections.flatMap((s) => s.questionIds).indexOf(currentQuestionId) + 1;
  const isNumerical = question.type === "NUMERICAL";
  const options = question.options ?? [];
  const displayOptions: ExamOption[] =
    options.length > 0
      ? options
      : ["A", "B", "C", "D"].map((label) => ({
          id: `${question.id}-opt-${label}`,
          label,
          text: "",
        }));
  let reviewCorrectValue = question.correctOptionId
    ? options.find((option) => option.id === question.correctOptionId)?.label ?? ""
    : question.correctNumericalAnswer ?? "";

  // Map A/B/C/D to 1/2/3/4 for NTA style UI
  const labelMap: Record<string, string> = { A: "1", B: "2", C: "3", D: "4" };
  if (reviewCorrectValue in labelMap) {
    reviewCorrectValue = labelMap[reviewCorrectValue];
  }
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
            {isTeacherEdit && review?.onQuestionTypeChange && (
              <button
                type="button"
                onClick={() => review.onQuestionTypeChange!(isNumerical ? "MCQ_SINGLE" : "NUMERICAL")}
                className="ml-2 text-[10px] text-blue-600 underline hover:text-blue-800"
              >
                Change to {isNumerical ? "MCQ" : "NAT"}
              </button>
            )}
            <span className="text-sm font-semibold text-gray-700 ml-1">
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

      <div className="px-3 py-3 md:px-5 md:py-4">
        


        <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden transition-shadow hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
          <div className="border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white px-5 py-3 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Question Text</span>
          </div>
          <div className="flex items-start gap-4 px-5 py-6 text-[15px] leading-relaxed text-gray-800">
            <span className="mt-0.5 font-extrabold text-slate-900 text-lg">
              Q{question.number}.
            </span>
            {question.stemImage ? (
              <div className="w-full">
                <img src={question.stemImage} alt="Question" className="max-w-full h-auto object-contain rounded-md" />
              </div>
            ) : isTeacherEdit ? (
              <textarea
                className="min-h-[120px] w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all outline-none"
                value={question.text}
                onChange={(event) => review?.onQuestionTextChange?.(event.target.value)}
              />
            ) : (
              <div className="min-w-0 flex-1 whitespace-pre-wrap break-words">
                {displayQuestionText ? (
                  <MathRenderer text={displayQuestionText} />
                ) : question.stemImage || question.images?.length ? null : (
                  <span className="text-sm italic text-slate-500">
                    Question text is unavailable. Ask your institute to review this paper.
                  </span>
                )}
              </div>
            )}
          </div>
          {question.images && question.images.length > 0 ? (
            <div className="px-5 pb-6 space-y-4">
              {question.images.map((img, i) => (
                img.trim().startsWith("<svg") ? (
                  <div key={i} className="flex justify-start rounded-xl border border-slate-100 bg-slate-50/50 p-4" dangerouslySetInnerHTML={{ __html: img }} />
                ) : img.trim().startsWith("/uploads") ? (
                  <img key={i} src={img} alt="Question Diagram" className="max-w-full h-auto object-contain rounded-xl border border-slate-100 shadow-sm mx-0" />
                ) : (
                  <div key={i} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm italic text-slate-600">
                    {img}
                  </div>
                )
              ))}
            </div>
          ) : question.hasImage && !question.stemImage ? (
            <div className="mx-5 mb-6 rounded-lg border border-blue-100 bg-blue-50/80 px-4 py-3 text-sm font-medium text-blue-800 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
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
            {(() => {
              const isVisionCrop = question.hasImage && !!question.stemImage;
              const allOptionsEmpty = displayOptions.every((opt) => !opt.text && !opt.image);
              const renderHorizontal = isVisionCrop && allOptionsEmpty;

              return (
                <ul className={cn(renderHorizontal ? "flex flex-wrap gap-8" : "space-y-3")}>
                  {displayOptions.map((option, optionIndex) => {
                    const displayLabel = String(optionIndex + 1);
                    const teacherValue = labelMap[option.label] ?? displayLabel;
                    const isSelected = isTeacherEdit
                      ? reviewCorrectValue === teacherValue
                      : selected === option.id;
                    return (
                      <li key={option.id} className={cn(renderHorizontal && "flex-1 min-w-[80px]")}>
                        <label
                          className={cn(
                            isTeacherEdit
                              ? "flex items-start gap-3 rounded border px-3 py-2 transition-colors"
                              : "flex w-full cursor-pointer items-center gap-3 rounded border px-4 py-2 text-sm transition-colors",
                            isTeacherEdit
                              ? "border-gray-300 bg-white"
                              : isSelected
                                ? "border-[#1a3c6e] bg-blue-50/50 text-gray-900"
                                : "border-gray-300 bg-white text-gray-900 hover:bg-gray-50 hover:border-gray-400",
                            isTeacherEdit && isSelected && "border-[#1a3c6e] bg-[#eef3fa]",
                            renderHorizontal && "border-none shadow-none bg-transparent hover:bg-transparent p-0",
                          )}
                          onClick={() => {
                            if (!isTeacherEdit) selectOption(question.id, option.id);
                          }}
                        >
                          {isTeacherEdit ? (
                            <input
                              type="radio"
                              name={question.id}
                              value={teacherValue}
                              checked={isSelected}
                              onChange={() => review?.onCorrectAnswerChange?.(option.label)}
                              className={cn("mt-0.5 h-4 w-4 shrink-0 accent-[#1a3c6e]", renderHorizontal && "mt-1")}
                            />
                          ) : (
                            <input
                              type="radio"
                              name={question.id}
                              value={option.id}
                              checked={isSelected}
                              readOnly
                              className={cn("mt-0.5 h-4 w-4 shrink-0 accent-[#1a3c6e] cursor-pointer", renderHorizontal && "mt-1")}
                            />
                          )}
                          <div
                            className={cn(
                              "flex flex-1 items-center gap-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed",
                              "text-gray-900",
                            )}
                          >
                            <span
                              className={cn(
                                "font-bold text-gray-700 shrink-0",
                                !renderHorizontal && "w-6"
                              )}
                            >
                              {displayLabel})
                            </span>
                            {!renderHorizontal && (
                              <div className="min-w-0 flex-1">
                                {option.image ? (
                                  <img
                                    src={option.image}
                                    alt={`Option ${displayLabel}`}
                                    className="max-h-40 max-w-full rounded border border-slate-100 object-contain"
                                  />
                                ) : isTeacherEdit ? (
                                  (question.hasImage || question.stemImage) && !option.text ? null : (
                                    <input
                                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                                      value={option.text || ""}
                                      placeholder="Option text (optional)"
                                      onChange={(event) =>
                                        review?.onOptionTextChange?.(option.label, event.target.value)
                                      }
                                    />
                                  )
                                ) : option.text ? (
                                  <MathRenderer text={option.text} />
                                ) : null}
                              </div>
                            )}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
            {isTeacherEdit && (
              <div className="mt-5 border-t border-gray-200 pt-4">
                <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                  Correct Answer:
                  <select
                    className="rounded-md border border-[#d7dde7] bg-white px-3 py-1.5 text-sm"
                    value={reviewCorrectValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      const opt = displayOptions.find(o => {
                        const lbl = String(displayOptions.indexOf(o) + 1);
                        const tVal = labelMap[o.label] ?? lbl;
                        return tVal === val;
                      });
                      if (opt) review?.onCorrectAnswerChange?.(opt.label);
                    }}
                  >
                    <option value="">Select option...</option>
                    {displayOptions.map((option, optionIndex) => {
                      const displayLabel = String(optionIndex + 1);
                      const teacherValue = labelMap[option.label] ?? displayLabel;
                      return (
                      <option key={option.id} value={teacherValue}>
                        Option {displayLabel}
                      </option>
                      );
                    })}
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
