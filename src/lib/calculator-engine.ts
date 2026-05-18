/** Safe expression evaluation for the exam calculator (numeric only). */

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function evaluateCalculatorExpression(expr: string): string {
  const trimmed = expr.trim();
  if (!trimmed) return "0";

  try {
    const js = trimmed
      .replace(/π/g, "Math.PI")
      .replace(/(\d+(?:\.\d+)?)\s*%/g, "($1/100)")
      .replace(/sin\(/g, "sinRad(")
      .replace(/cos\(/g, "cosRad(")
      .replace(/tan\(/g, "tanRad(")
      .replace(/sqrt\(/g, "Math.sqrt(")
      .replace(/ln\(/g, "Math.log(")
      .replace(/log\(/g, "Math.log10(");

    if (!/^[0-9+\-*/().%\sMath.a-z]*$/i.test(js)) {
      return "Error";
    }

    const sinRad = (x: number) => Math.sin(toRadians(x));
    const cosRad = (x: number) => Math.cos(toRadians(x));
    const tanRad = (x: number) => Math.tan(toRadians(x));

    const fn = new Function(
      "sinRad",
      "cosRad",
      "tanRad",
      "Math",
      `"use strict"; return (${js});`,
    );
    const result = fn(sinRad, cosRad, tanRad, Math);
    if (typeof result !== "number" || !Number.isFinite(result)) return "Error";
    const rounded = Math.round(result * 1e10) / 1e10;
    return String(rounded);
  } catch {
    return "Error";
  }
}
