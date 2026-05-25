"use client";

import { cn } from "@/lib/utils";
import { useQuestionStore } from "@/stores/question-store";
import { NumericalAnswerInput } from "./NumericalAnswerInput";

function getQuestionTypeLabel(type: string) {
  return type === "NUMERICAL" ? "Numerical (NAT)" : "MCQ";
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
  const isTeacherEdit = Boolean(review);
  const reviewCorrectValue = question.correctOptionId
    ? question.options.find((option) => option.id === question.correctOptionId)?.label ?? ""
    : question.correctNumericalAnswer ?? "";
  const hasIssues = (review?.issues?.length ?? 0) > 0;

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="border-b border-gray-200 bg-[#f8fafc] px-6 py-3">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-[#1a3c6e]">
            {getQuestionTypeLabel(question.type)}
          </h3>
          <span className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700">
            +{question.marks}
            {question.negativeMarks > 0 ? ` / -${question.negativeMarks}` : ""}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          {section?.name} · Q{question.number} (#{globalIndex})
        </p>
      </div>

      <div className="px-4 py-5 md:px-8 md:py-7">
        <div className="mb-7 rounded-md border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-[#f8fafc] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#1a3c6e]">
            Question
          </div>
          <div className="flex items-start gap-3 px-4 py-4 text-[15px] leading-7 text-gray-950">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1a3c6e] text-xs font-bold text-white">
              {question.number}
            </span>
            {isTeacherEdit ? (
              <textarea
                className="min-h-[100px] w-full rounded-md border border-[#d7dde7] px-3 py-2 text-sm text-gray-900"
                value={question.text}
                onChange={(event) => review?.onQuestionTextChange?.(event.target.value)}
              />
            ) : (
              <p className="whitespace-pre-wrap">{question.text}</p>
            )}
          </div>
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
            <NumericalAnswerInput
              questionId={question.id}
              value={selected}
              onValueChange={setNumericalAnswer}
            />
          )
        ) : (
          <fieldset className="rounded-md border border-gray-200 p-4">
            <legend className="mb-3 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Options
            </legend>
            <ul className="space-y-3">
              {question.options.map((opt) => {
                const isSelected = isTeacherEdit
                  ? reviewCorrectValue === opt.label
                  : selected === opt.id;
                return (
                  <li key={opt.id}>
                    <label
                      className={cn(
                        "flex items-start gap-4 rounded-md border px-4 py-3.5 shadow-sm transition-colors",
                        isTeacherEdit ? "border-[#d7dde7] bg-white" : "cursor-pointer border-gray-300 bg-white hover:border-gray-400",
                        isSelected && "border-[#1a3c6e] bg-[#eef3fa]",
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={opt.id}
                        checked={isSelected}
                        onChange={() =>
                          isTeacherEdit
                            ? review?.onCorrectAnswerChange?.(opt.label)
                            : selectOption(question.id, opt.id)
                        }
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1a3c6e]"
                      />
                      <span className="flex-1 text-sm leading-6 text-gray-950">
                        <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border border-[#1a3c6e] bg-white text-xs font-bold text-[#1a3c6e]">
                          {opt.label}
                        </span>
                        {isTeacherEdit ? (
                          <input
                            className="w-[calc(100%-2.5rem)] rounded-md border border-[#d7dde7] px-2 py-1 text-sm"
                            value={opt.text}
                            onChange={(event) => review?.onOptionTextChange?.(opt.label, event.target.value)}
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

        {isTeacherEdit ? (
          <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-sm font-medium text-[#14213d]">
              Marks
              <input
                className="w-full rounded-md border border-[#d7dde7] px-3 py-2 text-sm"
                value={String(question.marks)}
                onChange={(event) => review?.onMarksChange?.(event.target.value)}
              />
            </label>
            <label className="space-y-1 text-sm font-medium text-[#14213d]">
              Negative
              <input
                className="w-full rounded-md border border-[#d7dde7] px-3 py-2 text-sm"
                value={String(question.negativeMarks)}
                onChange={(event) => review?.onNegativeMarksChange?.(event.target.value)}
              />
            </label>
          </div>
        ) : null}

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
