"use client";

import { cn } from "@/lib/utils";
import { useQuestionStore } from "@/stores/question-store";
import { NumericalAnswerInput } from "./NumericalAnswerInput";

function getQuestionTypeLabel(type: string) {
  return type === "NUMERICAL" ? "Numerical Value" : "Single Correct MCQ";
}

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

  if (!exam || !currentQuestionId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white text-gray-500">
        Loading question...
      </div>
    );
  }

  const question = exam.questions[currentQuestionId];
  if (!question) return null;

  const section = exam.sections.find((s) => s.id === question.sectionId);
  const selected = answers[currentQuestionId] ?? "";
  const globalIndex = exam.sections.flatMap((s) => s.questionIds).indexOf(currentQuestionId) + 1;
  const isNumerical = question.type === "NUMERICAL";
  const reviewCorrectValue = question.correctOptionId
    ? question.options.find((option) => option.id === question.correctOptionId)?.label ?? ""
    : question.correctNumericalAnswer ?? "";

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="border-b border-gray-200 bg-[#f8fafc] px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-[#1a3c6e]">
            Question Type: {getQuestionTypeLabel(question.type)}
          </h3>
          <span className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
            Marks: +{question.marks}
            {question.negativeMarks > 0 ? ` / -${question.negativeMarks}` : ""}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Section: {section?.name} | Q. {question.number} (Overall #{globalIndex})
        </p>
        {review ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-[#f5f1e8] px-2 py-1 font-medium text-[#8a6f3e]">
              Teacher Review Mode
            </span>
            {review.flagged ? (
              <span className="rounded-full bg-amber-100 px-2 py-1 font-medium text-amber-800">
                Parsing issue flagged
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="px-8 py-6">
        {review ? (
          <div className="mb-4 rounded-xl border border-[#ece6da] bg-[#fbf9f4] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#14213d]">Review controls</p>
              {review.onToggleFlag ? (
                <button
                  type="button"
                  onClick={review.onToggleFlag}
                  className="rounded border border-[#d7c59e] px-3 py-1 text-xs font-medium text-[#8a6f3e] hover:bg-[#f5f1e8]"
                >
                  {review.flagged ? "Clear parsing flag" : "Flag parsing issue"}
                </button>
              ) : null}
            </div>
            {review.issues && review.issues.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm text-amber-800">
                {review.issues.map((issue) => (
                  <li key={issue}>• {issue}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-[#5e5a52]">
                No question-specific validation issues right now.
              </p>
            )}
          </div>
        ) : null}

        <div className="mb-6">
          <div className="mb-2 flex items-start gap-2 text-[15px] leading-relaxed text-gray-900">
            <span className="font-bold text-[#1a3c6e]">Q.{question.number}.</span>
            {review ? (
              <textarea
                className="min-h-[110px] w-full rounded-md border border-[#d7dde7] px-3 py-2 text-sm text-gray-900"
                value={question.text}
                onChange={(event) => review.onQuestionTextChange?.(event.target.value)}
              />
            ) : (
              <p>{question.text}</p>
            )}
          </div>
        </div>

        {isNumerical ? (
          review ? (
            <div className="space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500">
                Correct numerical answer
              </label>
              <input
                className="w-full rounded-md border border-[#d7dde7] px-3 py-2 text-sm"
                value={reviewCorrectValue}
                onChange={(event) => review.onCorrectAnswerChange?.(event.target.value)}
              />
            </div>
          ) : (
            <NumericalAnswerInput
              questionId={question.id}
              value={selected}
              onValueChange={setNumericalAnswer}
            />
          )
        ) : (
          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              {review ? "Review options" : "Select one option"}
            </legend>
            <ul className="space-y-2.5">
              {question.options.map((opt) => {
                const isSelected = review ? reviewCorrectValue === opt.label : selected === opt.id;
                return (
                  <li key={opt.id}>
                    <label
                      className={cn(
                        "flex items-start gap-3 rounded-sm border-2 px-4 py-3 transition-colors",
                        review ? "border-[#d7dde7] bg-white" : "cursor-pointer",
                        isSelected
                          ? "border-[#1a3c6e] bg-[#eef3fa]"
                          : !review
                            ? "border-gray-300 bg-white hover:border-gray-400"
                            : "border-gray-300 bg-white",
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={opt.id}
                        checked={isSelected}
                        onChange={() =>
                          review
                            ? review.onCorrectAnswerChange?.(opt.label)
                            : selectOption(question.id, opt.id)
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1a3c6e]"
                      />
                      <span className="flex-1 text-sm leading-relaxed text-gray-900">
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#1a3c6e] text-xs font-bold text-[#1a3c6e]">
                          {opt.label}
                        </span>
                        {review ? (
                          <input
                            className="w-[calc(100%-2.5rem)] rounded-md border border-[#d7dde7] px-2 py-1 text-sm"
                            value={opt.text}
                            onChange={(event) => review.onOptionTextChange?.(opt.label, event.target.value)}
                          />
                        ) : (
                          opt.text
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {review ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-[#14213d]">
              <span>Marks</span>
              <input
                className="w-full rounded-md border border-[#d7dde7] px-3 py-2 text-sm"
                value={String(question.marks)}
                onChange={(event) => review.onMarksChange?.(event.target.value)}
              />
            </label>
            <label className="space-y-2 text-sm font-medium text-[#14213d]">
              <span>Negative marks</span>
              <input
                className="w-full rounded-md border border-[#d7dde7] px-3 py-2 text-sm"
                value={String(question.negativeMarks)}
                onChange={(event) => review.onNegativeMarksChange?.(event.target.value)}
              />
            </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
