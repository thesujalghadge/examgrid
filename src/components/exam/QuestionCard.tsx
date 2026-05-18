"use client";

import { getQuestionTypeLabel } from "@/data/mock-exams";
import { cn } from "@/lib/utils";
import { useQuestionStore } from "@/stores/question-store";
import { NumericalAnswerInput } from "./NumericalAnswerInput";
import { StatusBadge } from "@/components/shared/product-ui";

export function QuestionCard() {
  const exam = useQuestionStore((s) => s.exam);
  const currentQuestionId = useQuestionStore((s) => s.currentQuestionId);
  const answers = useQuestionStore((s) => s.answers);
  const selectOption = useQuestionStore((s) => s.selectOption);
  const setNumericalAnswer = useQuestionStore((s) => s.setNumericalAnswer);

  if (!exam || !currentQuestionId) {
    return (
      <div className="flex flex-1 items-center justify-center bg-background text-sm text-muted-foreground">
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
    <div className="flex flex-1 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-muted/10 px-4 py-3 md:px-6">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-primary">
              {getQuestionTypeLabel(question.type)}
            </h3>
            <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
            <span className="hidden text-xs text-muted-foreground sm:block">
              {section?.name} · Q. {question.number} (Overall #{globalIndex})
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground sm:hidden">
            {section?.name} · Q. {question.number}
          </span>
        </div>
        <StatusBadge tone="neutral" className="shrink-0 text-xs shadow-sm">
          +{question.marks} {question.negativeMarks > 0 ? ` / -${question.negativeMarks}` : ""}
        </StatusBadge>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-6 md:px-8 md:py-8 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none mb-8">
            <p className="text-foreground leading-relaxed text-sm md:text-base">
              <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary shadow-sm select-none">
                {question.number}
              </span>
              {question.text}
            </p>
          </div>

          {isNumerical ? (
            <div className="mt-8 max-w-md">
              <NumericalAnswerInput
                questionId={question.id}
                value={selected}
                onValueChange={setNumericalAnswer}
              />
            </div>
          ) : (
            <fieldset className="mt-8">
              <legend className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Select one option
              </legend>
              <ul className="grid gap-3 sm:grid-cols-2 lg:gap-4">
                {question.options.map((opt) => {
                  const isSelected = selected === opt.id;
                  return (
                    <li key={opt.id}>
                      <label
                        className={cn(
                          "group relative flex cursor-pointer items-start gap-4 rounded-xl border-2 p-4 transition-all duration-200 active:scale-[0.99]",
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20"
                            : "border-border bg-card hover:border-primary/50 hover:bg-muted/50",
                        )}
                      >
                        <div className="flex h-5 items-center">
                          <div className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                            isSelected ? "border-primary bg-primary" : "border-input bg-background group-hover:border-primary/50"
                          )}>
                            {isSelected && <div className="h-2 w-2 rounded-full bg-primary-foreground" />}
                          </div>
                        </div>
                        <input
                          type="radio"
                          name={question.id}
                          value={opt.id}
                          checked={isSelected}
                          onChange={() => selectOption(question.id, opt.id)}
                          className="sr-only"
                        />
                        <span className="text-sm font-medium leading-relaxed text-foreground flex-1">
                          <span className="mr-3 font-mono text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors">
                            {opt.label}.
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
    </div>
  );
}
