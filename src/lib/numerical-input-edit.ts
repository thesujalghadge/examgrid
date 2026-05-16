import { isValidNumericalInput } from "@/lib/numerical";

export type NumericalKeyAction =
  | { type: "digit"; digit: string }
  | { type: "decimal" }
  | { type: "minus" }
  | { type: "backspace" }
  | { type: "clear" };

export interface NumericalEditResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

function clampSelection(value: string, start: number, end: number) {
  const len = value.length;
  return {
    start: Math.max(0, Math.min(start, len)),
    end: Math.max(0, Math.min(end, len)),
  };
}

function tryApply(value: string, start: number, end: number): NumericalEditResult | null {
  if (!isValidNumericalInput(value)) return null;
  const { start: selectionStart, end: selectionEnd } = clampSelection(
    value,
    start,
    end,
  );
  return { value, selectionStart, selectionEnd };
}

/** Apply a keypad action at the current cursor / selection. */
export function applyNumericalKeyAction(
  currentValue: string,
  selectionStart: number,
  selectionEnd: number,
  action: NumericalKeyAction,
): NumericalEditResult | null {
  const value = currentValue ?? "";
  const { start, end } = clampSelection(value, selectionStart, selectionEnd);

  if (action.type === "clear") {
    return tryApply("", 0, 0);
  }

  if (action.type === "backspace") {
    if (start !== end) {
      const next = value.slice(0, start) + value.slice(end);
      return tryApply(next, start, start);
    }
    if (start === 0) return tryApply(value, 0, 0);
    const next = value.slice(0, start - 1) + value.slice(start);
    return tryApply(next, start - 1, start - 1);
  }

  if (action.type === "minus") {
    if (start !== 0 || end !== 0) return null;
    if (value.startsWith("-")) {
      const next = value.slice(1);
      return tryApply(next, 0, 0);
    }
    const next = "-" + value;
    return tryApply(next, 1, 1);
  }

  if (action.type === "decimal") {
    if (value.includes(".")) return null;
    const insert = ".";
    const next = value.slice(0, start) + insert + value.slice(end);
    const pos = start + 1;
    return tryApply(next, pos, pos);
  }

  if (action.type === "digit") {
    const next = value.slice(0, start) + action.digit + value.slice(end);
    const pos = start + action.digit.length;
    return tryApply(next, pos, pos);
  }

  return null;
}

/** Replace value from physical typing while preserving a valid partial numeric string. */
export function applyPhysicalNumericalValue(
  nextValue: string,
  prevValue: string,
  selectionStart: number,
  selectionEnd: number,
): NumericalEditResult | null {
  if (!isValidNumericalInput(nextValue)) return null;

  const { start, end } = clampSelection(nextValue, selectionStart, selectionEnd);

  if (nextValue.length > prevValue.length) {
    return tryApply(nextValue, end, end);
  }

  return tryApply(nextValue, start, end);
}
