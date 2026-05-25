import type { PaperSubjectMapping, ProcessedPaperPackage } from "@/types/cbt-paper-processing";

export const JEE_SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"] as const;

export function defaultSubjectMapping(totalQuestions: number): PaperSubjectMapping {
  return {
    mode: "single",
    singleSubject: "Physics",
    ranges:
      totalQuestions > 0
        ? [{ start: 1, end: totalQuestions, subject: "Physics" }]
        : [],
    appliedAt: Date.now(),
  };
}

export function applySubjectMapping(pkg: ProcessedPaperPackage): ProcessedPaperPackage {
  const mapping = pkg.subjectMapping;
  if (!mapping) return pkg;

  let globalIndex = 0;
  const sections = pkg.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question) => {
      globalIndex += 1;
      const subject = resolveSubjectForQuestion(globalIndex, mapping);
      return { ...question, subject };
    }),
  }));

  return {
    ...pkg,
    sections,
    subjectMapping: { ...mapping, appliedAt: Date.now() },
  };
}

export function resolveSubjectForQuestion(
  questionNumber: number,
  mapping: PaperSubjectMapping,
): string {
  if (mapping.mode === "single" && mapping.singleSubject?.trim()) {
    return mapping.singleSubject.trim();
  }
  if (mapping.mode === "multi" && mapping.ranges?.length) {
    const match = mapping.ranges.find(
      (range) => questionNumber >= range.start && questionNumber <= range.end,
    );
    if (match?.subject.trim()) return match.subject.trim();
  }
  return mapping.singleSubject?.trim() || "Imported Questions";
}

export function validateSubjectMapping(
  totalQuestions: number,
  mapping: PaperSubjectMapping,
): string[] {
  const issues: string[] = [];
  if (totalQuestions === 0) return issues;

  if (mapping.mode === "single") {
    if (!mapping.singleSubject?.trim()) {
      issues.push("Select a subject for the full paper.");
    }
    return issues;
  }

  const ranges = mapping.ranges ?? [];
  if (ranges.length === 0) {
    issues.push("Add at least one question range for multi-subject mapping.");
    return issues;
  }

  for (const range of ranges) {
    if (!range.subject.trim()) {
      issues.push(`Range ${range.start}-${range.end} needs a subject.`);
    }
    if (range.start < 1 || range.end < range.start) {
      issues.push(`Range ${range.start}-${range.end} is invalid.`);
    }
    if (range.end > totalQuestions) {
      issues.push(`Range ${range.start}-${range.end} exceeds ${totalQuestions} questions.`);
    }
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.start <= previous.end) {
      issues.push(`Ranges ${previous.start}-${previous.end} and ${current.start}-${current.end} overlap.`);
    }
  }

  const covered = new Set<number>();
  for (const range of ranges) {
    for (let n = range.start; n <= range.end; n += 1) {
      if (n >= 1 && n <= totalQuestions) covered.add(n);
    }
  }
  if (covered.size < totalQuestions) {
    issues.push("Some questions are not covered by a subject range.");
  }

  return issues;
}
