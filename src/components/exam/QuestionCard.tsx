"use client";

import { getQuestionTypeLabel } from "@/data/mock-exams";
import { cn } from "@/lib/utils";
import { useQuestionStore } from "@/stores/question-store";
import { NumericalAnswerInput } from "./NumericalAnswerInput";

export function QuestionCard() {
  const exam = useQuestionStore((s) => s.exam);
  const currentQuestionId = useQuestionStore((s) => s.currentQuestionId);
  const answers = useQuestionStore((s) => s.answers);
  const selectOption = useQuestionStore((s) => s.selectOption);
  const setNumericalAnswer = useQuestionStore((s) => s.setNumericalAnswer);

  if (!exam || !currentQuestionId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white text-gray-500">
        Loading question…
      </div>
    );
  }

  const question = exam.questions[currentQuestionId];
  if (!question) return null;

  const section = exam.sections.find((s) => s.id === question.sectionId);
  const selected = answers[currentQuestionId] ?? "";
  const globalIndex =
    exam.sections.flatMap((s) => s.questionIds).indexOf(currentQuestionId) + 1;
  const isNumerical = question.type === "NUMERICAL";

  return (
    <div className="flex-1 overflow-y-auto bg-white">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-bold text-[var(--eg-cbt)]">
            Question Type: {getQuestionTypeLabel(question.type)}
          </h3>
          <span className="rounded-md border border-slate-200 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700">
            Marks: +{question.marks}
            {question.negativeMarks > 0 ? ` / −${question.negativeMarks}` : ""}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Section: {section?.name} · Q. {question.number} (Overall #{globalIndex})
        </p>
      </div>

      <div className="px-6 py-6 sm:px-8">
        <p className="mb-6 text-base leading-relaxed text-slate-900">
          <span className="mr-2 font-bold text-[var(--eg-cbt)]">
            Q.{question.number}.
          </span>
          {question.text}
        </p>

        {isNumerical ? (
          <NumericalAnswerInput
            questionId={question.id}
            value={selected}
            onValueChange={setNumericalAnswer}
          />
        ) : (
          <fieldset>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Select one option
            </legend>
            <ul className="space-y-2.5">
              {question.options.map((opt) => {
                const isSelected = selected === opt.id;
                return (
                  <li key={opt.id}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-sm border-2 px-4 py-3 transition-colors",
                        isSelected
                          ? "border-[var(--eg-cbt)] bg-blue-50/80"
                          : "border-slate-300 bg-white hover:border-slate-400",
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={opt.id}
                        checked={isSelected}
                        onChange={() => selectOption(question.id, opt.id)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#1a3c6e]"
                      />
                      <span className="text-sm leading-relaxed text-gray-900">
                        <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full border border-[#1a3c6e] text-xs font-bold text-[#1a3c6e]">
                          {opt.label}
                        </span>
                        {opt.text}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
      </div>
    </div>
  );
}
