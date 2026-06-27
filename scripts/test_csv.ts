import { readFileSync } from 'fs';
import { resolve } from 'path';

function sanitizeLine(line: string) { return line.trim(); }

function normalizeAnswerKeyText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\r/g, "\n")
    .replace(/Page\s+\d+\s+of\s+\d+/gi, " ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/www\.\S+/gi, " ")
    .replace(/\S+@\S+\.\S+/gi, " ")
    .replace(/\u00a9.*$/gim, " ")
    .replace(/©.*$/gim, " ")
    .replace(/all rights reserved.*/gi, " ")
    .replace(/[-_]{3,}/g, " ")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .trim()
    .split("\n")
    .filter((line) => !/^[\s\d.\-|#*]{1,3}$/.test(line))
    .join("\n")
    .trim()
    .replace(/(\d{1,3})\s*,\s*([A-Da-d])/g, "$1,$2")
    .replace(/(\d{1,3})\s*,\s*(-?\d)/g, "$1,$2")
    .replace(/[|;/\\]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ");
}

function parseAnswerKeyEntries(text: string) {
  const normalized = normalizeAnswerKeyText(text);
  const entries: any[] = [];
  const seen = new Set<number>();

  const lines = normalized.split("\n").map((line) => sanitizeLine(line)).filter(Boolean);
  for (const line of lines) {
    const cells = line
      .split(/\s{2,}|\t+|,/)
      .map((cell) => sanitizeLine(cell.replace(/["']/g, "")))
      .filter(Boolean);
      
    if (cells.length >= 2) {
      const qMatch = cells[0].match(/^(\d{1,3})$/);
      const aMatch = cells[1].match(/^\(?\s*([A-D]|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)\s*\)?$/i);
      if (qMatch && aMatch) {
        const questionNumber = Number(qMatch[1]);
        if (!seen.has(questionNumber)) {
          seen.add(questionNumber);
          entries.push({
            questionNumber,
            answer: aMatch[1].toUpperCase(),
            raw: line,
          });
        }
      }
    }
  }
  return entries;
}

const sampleCSV = `"1","A"
"2","B"
"3","C"
"4","D"
5,1
6,2
`;

console.log("Parsed:", parseAnswerKeyEntries(sampleCSV));
