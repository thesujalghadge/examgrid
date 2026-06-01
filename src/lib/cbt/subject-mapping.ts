import type {
  PaperSubjectMapping,
  ProcessedPaperPackage,
  SubjectPaperLayout,
  SubjectRangeMapping,
} from "@/types/cbt-paper-processing";

export const JEE_SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology"] as const;

export function rangesForLayout(
  layout: SubjectPaperLayout,
  totalQuestions: number,
): SubjectRangeMapping[] {
  const total = Math.max(1, totalQuestions);
  if (layout === "single") {
    return [{ start: 1, end: total, subject: "Physics" }];
  }
  if (layout === "two") {
    const mid = Math.max(1, Math.floor(total / 2));
    return [
      { start: 1, end: mid, subject: "Physics" },
      { start: mid + 1, end: total, subject: "Chemistry" },
    ];
  }
  const third = Math.max(1, Math.ceil(total / 3));
  const twoThird = Math.min(total, third * 2);
  return [
    { start: 1, end: third, subject: "Mathematics" },
    { start: third + 1, end: twoThird, subject: "Physics" },
    { start: twoThird + 1, end: total, subject: "Chemistry" },
  ];
}

export function defaultSubjectMapping(
  totalQuestions: number,
  layout: SubjectPaperLayout = "full",
  singleSubject = "Physics",
): PaperSubjectMapping {
  if (layout === "single") {
    return {
      layout: "single",
      mode: "single",
      singleSubject,
      ranges: [{ start: 1, end: Math.max(1, totalQuestions), subject: singleSubject }],
      appliedAt: Date.now(),
    };
  }
  return {
    layout,
    mode: "multi",
    ranges: rangesForLayout(layout, totalQuestions),
    appliedAt: Date.now(),
  };
}

export function applySubjectMapping(pkg: ProcessedPaperPackage): ProcessedPaperPackage {
  const mapping = pkg.subjectMapping;
  if (!mapping) return pkg;

  // Flatten all questions first
  const allQuestions = pkg.sections.flatMap(s => s.questions);
  
  // Group by resolved subject
  const sectionMap = new Map<string, typeof allQuestions>();
  
  let globalIndex = 0;
  for (const question of allQuestions) {
    globalIndex += 1;
    const subject = resolveSubjectForQuestion(globalIndex, mapping);
    
    if (!sectionMap.has(subject)) sectionMap.set(subject, []);
    
    sectionMap.get(subject)!.push({
      ...question,
      subject,
      section: subject, // update section reference
      metadata: {
        ...question.metadata,
        subjectGlobalQuestionNumber: globalIndex,
        subjectMappingLayout: mapping.layout,
      },
    });
  }

  // Create new sections array
  const sections = Array.from(sectionMap.entries()).map(([name, questions]) => ({
    id: `section-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    name,
    questions,
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

  if (mapping.layout === "single" || mapping.mode === "single") {
    if (!mapping.singleSubject?.trim()) {
      issues.push("Choose a subject for this paper.");
    }
    return issues;
  }

  const ranges = mapping.ranges ?? [];
  if (ranges.length === 0) {
    issues.push("Set question ranges for each subject.");
    return issues;
  }

  for (const range of ranges) {
    if (!range.subject.trim()) {
      issues.push(`Questions ${range.start}–${range.end} need a subject.`);
    }
    if (range.start < 1 || range.end < range.start) {
      issues.push(`Range ${range.start}–${range.end} is not valid.`);
    }
    if (range.end > totalQuestions) {
      issues.push(`Range ${range.start}–${range.end} goes past question ${totalQuestions}.`);
    }
  }

  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1];
    const current = sorted[index];
    if (current.start <= previous.end) {
      issues.push(`Ranges ${previous.start}–${previous.end} and ${current.start}–${current.end} overlap.`);
    }
  }

  const covered = new Set<number>();
  for (const range of ranges) {
    for (let n = range.start; n <= range.end; n += 1) {
      if (n >= 1 && n <= totalQuestions) covered.add(n);
    }
  }
  if (covered.size < totalQuestions) {
    issues.push("Some questions are not assigned to a subject range.");
  }

  return issues;
}
