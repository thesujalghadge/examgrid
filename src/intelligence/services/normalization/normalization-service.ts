export const NORMALIZATION_VERSION = "norm-2026-05-18";

export interface NormalizationResult {
  text: string;
  issues: string[];
  version: string;
}

const SYMBOL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/×/g, " x "],
  [/÷/g, " / "],
  [/−/g, "-"],
  [/–|—/g, "-"],
  [/µ/g, "u"],
  [/π/g, "pi"],
  [/∞/g, "infinity"],
  [/√/g, "sqrt"],
  [/≤/g, "<="],
  [/≥/g, ">="],
  [/≠/g, "!="],
  [/\u00a0/g, " "],
];

export function normalizeAcademicText(input: string): NormalizationResult {
  const issues: string[] = [];
  let text = input.normalize("NFKC");

  SYMBOL_REPLACEMENTS.forEach(([pattern, replacement]) => {
    if (pattern.test(text)) issues.push(`symbol:${String(pattern)}`);
    text = text.replace(pattern, replacement);
  });

  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();

  if (/\([a-d]\)/i.test(text)) {
    text = text.replace(/\(([a-d])\)/gi, "\n$1.");
    issues.push("option-format-normalized");
  }

  if (/\b(m\/s2|ms-2)\b/i.test(text)) {
    text = text.replace(/\b(m\/s2|ms-2)\b/gi, "m/s^2");
    issues.push("unit-normalized");
  }

  return { text, issues, version: NORMALIZATION_VERSION };
}

export function prepareLatexText(input: string): string {
  return normalizeAcademicText(input)
    .text.replace(/\^(\d+)/g, "^{$1}")
    .replace(/\bsqrt\s*\(([^)]+)\)/g, "\\sqrt{$1}");
}

