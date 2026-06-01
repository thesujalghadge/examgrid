"use client";

import { useCallback, useEffect, useRef } from "react";
import { numericalInputConfig } from "@/config/numerical-input";
import { isValidNumericalInput } from "@/lib/numerical";
import {
  applyNumericalKeyAction,
  applyPhysicalNumericalValue,
  type NumericalKeyAction,
} from "@/lib/numerical-input-edit";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericalKeyboard } from "./NumericalKeyboard";

export interface NumericalAnswerInputProps {
  questionId: string;
  value: string;
  onValueChange: (questionId: string, value: string) => void;
  disabled?: boolean;
}

export function NumericalAnswerInput({
  questionId,
  value,
  onValueChange,
  disabled = false,
}: NumericalAnswerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectionRef = useRef({ start: 0, end: 0 });
  const valueRef = useRef(value);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    selectionRef.current = { start: value.length, end: value.length };
  }, [questionId, value.length]);

  const syncSelectionFromInput = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    selectionRef.current = {
      start: el.selectionStart ?? value.length,
      end: el.selectionEnd ?? value.length,
    };
  }, [value.length]);

  const applyEdit = useCallback(
    (result: { value: string; selectionStart: number; selectionEnd: number }) => {
      valueRef.current = result.value;
      onValueChange(questionId, result.value);
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(result.selectionStart, result.selectionEnd);
        selectionRef.current = {
          start: result.selectionStart,
          end: result.selectionEnd,
        };
      });
    },
    [onValueChange, questionId],
  );

  const handleKeyAction = useCallback(
    (action: NumericalKeyAction) => {
      if (disabled) return;
      syncSelectionFromInput();
      const { start, end } = selectionRef.current;
      const result = applyNumericalKeyAction(valueRef.current, start, end, action);
      if (result) applyEdit(result);
    },
    [applyEdit, disabled, syncSelectionFromInput],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!numericalInputConfig.allowPhysicalKeyboard) return;
      const next = e.target.value;
      const prev = valueRef.current;
      if (!isValidNumericalInput(next)) return;

      const start = e.target.selectionStart ?? next.length;
      const end = e.target.selectionEnd ?? next.length;
      const result = applyPhysicalNumericalValue(next, prev, start, end);
      if (result) {
        applyEdit(result);
      } else {
        onValueChange(questionId, next);
      }
    },
    [applyEdit, onValueChange, questionId],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!numericalInputConfig.allowPhysicalKeyboard || disabled) {
        e.preventDefault();
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        handleKeyAction({ type: "backspace" });
      }
    },
    [disabled, handleKeyAction],
  );

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-8">
      <div className="min-w-0 flex-1 space-y-2">
        <Label
          htmlFor={`numerical-answer-${questionId}`}
          className="text-xs font-semibold uppercase tracking-wide text-gray-500"
        >
          Enter numerical answer
        </Label>
        <Input
          ref={inputRef}
          id={`numerical-answer-${questionId}`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="Use keypad or type answer"
          value={value}
          readOnly={!numericalInputConfig.allowPhysicalKeyboard}
          disabled={disabled}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onClick={syncSelectionFromInput}
          onKeyUp={syncSelectionFromInput}
          onSelect={syncSelectionFromInput}
          onFocus={syncSelectionFromInput}
          className={cn(
            "h-12 border-2 border-[#1a3c6e]/40 font-mono text-xl tracking-wide focus-visible:border-[#1a3c6e]",
            !numericalInputConfig.allowPhysicalKeyboard && "cursor-default",
          )}
          aria-describedby={`numerical-hint-${questionId}`}
        />
        <p
          id={`numerical-hint-${questionId}`}
          className="text-xs text-gray-500"
        >
          {numericalInputConfig.allowPhysicalKeyboard
            ? "Use the on-screen keypad or your keyboard. Decimal and negative values allowed."
            : "Use the on-screen keypad only. Decimal and negative values allowed."}
        </p>
      </div>

      <NumericalKeyboard
        onKeyAction={handleKeyAction}
        disabled={disabled}
        className="shrink-0"
      />
    </div>
  );
}
