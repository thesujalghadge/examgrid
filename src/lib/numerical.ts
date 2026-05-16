/** Normalize numeric answer strings for exact-match scoring. */
export function normalizeNumerical(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "";
  const trimmed = value.trim();
  const num = Number(trimmed);
  if (Number.isNaN(num)) return trimmed;
  return String(num);
}

export function isValidNumericalInput(value: string): boolean {
  if (value === "" || value === "-" || value === "." || value === "-.") return true;
  return /^-?\d*\.?\d*$/.test(value);
}

export function isNumericalAnswerAttempted(value: string | null | undefined): boolean {
  if (value == null) return false;
  const n = normalizeNumerical(value);
  return n !== "";
}

export function isNumericalAnswerCorrect(
  answer: string | null | undefined,
  correct: string | undefined,
): boolean {
  if (!correct) return false;
  const a = normalizeNumerical(answer);
  const c = normalizeNumerical(correct);
  if (a === "" || c === "") return false;
  return a === c;
}
