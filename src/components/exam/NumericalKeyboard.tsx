"use client";

import type { NumericalKeyAction } from "@/lib/numerical-input-edit";
import { cn } from "@/lib/utils";

export interface NumericalKeyboardProps {
  onKeyAction: (action: NumericalKeyAction) => void;
  disabled?: boolean;
  className?: string;
}

const KEY_CLASS =
  "flex h-11 items-center justify-center rounded-md border border-[var(--eg-cbt)]/25 bg-white text-base font-semibold text-[var(--eg-cbt)] shadow-sm transition-colors hover:bg-blue-50 active:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--eg-cbt)] disabled:pointer-events-none disabled:opacity-50";

const ACTION_CLASS =
  "flex h-11 items-center justify-center rounded border border-gray-400 bg-[#f4f6f9] text-sm font-bold text-gray-800 shadow-sm transition-colors hover:bg-gray-200 active:bg-gray-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a3c6e] disabled:pointer-events-none disabled:opacity-50";

export function NumericalKeyboard({
  onKeyAction,
  disabled = false,
  className,
}: NumericalKeyboardProps) {
  const digit = (d: string) => () =>
    !disabled && onKeyAction({ type: "digit", digit: d });

  return (
    <div
      className={cn(
        "inline-block w-full max-w-[280px] rounded-lg border-2 border-[var(--eg-cbt)]/30 bg-blue-50/60 p-2.5 shadow-inner",
        className,
      )}
      role="group"
      aria-label="Numerical answer keypad"
    >
      <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--eg-cbt)]">
        Enter your answer
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {["7", "8", "9", "4", "5", "6", "1", "2", "3"].map((d) => (
          <KeyButton
            key={d}
            label={d}
            disabled={disabled}
            onClick={digit(d)}
          />
        ))}
        <KeyButton label="0" disabled={disabled} onClick={digit("0")} />
        <KeyButton
          label="."
          disabled={disabled}
          onClick={() => !disabled && onKeyAction({ type: "decimal" })}
        />
        <KeyButton
          label="−"
          disabled={disabled}
          onClick={() => !disabled && onKeyAction({ type: "minus" })}
          ariaLabel="Minus sign"
        />
        <ActionButton
          label="⌫"
          disabled={disabled}
          onClick={() => !disabled && onKeyAction({ type: "backspace" })}
          ariaLabel="Backspace"
          className="col-span-2"
        />
        <ActionButton
          label="Clear"
          disabled={disabled}
          onClick={() => !disabled && onKeyAction({ type: "clear" })}
          ariaLabel="Clear answer"
        />
      </div>
    </div>
  );
}

function KeyButton({
  label,
  onClick,
  disabled,
  ariaLabel,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={KEY_CLASS}
      aria-label={ariaLabel ?? `Digit ${label}`}
    >
      {label}
    </button>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  ariaLabel,
  className,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(ACTION_CLASS, className)}
      aria-label={ariaLabel}
    >
      {label}
    </button>
  );
}
