export function stripLeadingQuestionNumber(text: string): string {
  return text.replace(/^[\(\[]?\d{1,3}[\)\].]?\s+/, "").trim();
}

export function formatInlineMath(text: string): string {
  if (/\\\(|\\\[|\$/.test(text)) return text;
  let out = text.replace(/\b([A-Za-z]+)(\d+)/g, "$1<sub>$2</sub>");
  out = out.replace(/\^(\d+)/g, "<sup>$1</sup>");
  return out;
}
