import { isKnownTaxonomyPath } from "@/lib/academic-taxonomy";
import { findDuplicateCandidates, prepareArchetypeClusters, prepareSimilarityGroups } from "@/lib/question-intelligence/utils";
import type { BankQuestion } from "@/types/question-bank";

export type MetadataIssueSeverity = "warning" | "error";

export interface MetadataQualityIssue {
  questionId: string;
  type:
    | "missing_metadata"
    | "incomplete_taxonomy"
    | "orphan_topic"
    | "low_quality_question"
    | "duplicate_candidate";
  severity: MetadataIssueSeverity;
  message: string;
}

export interface MetadataQualityReport {
  totalQuestions: number;
  issueCount: number;
  missingMetadataCount: number;
  incompleteTaxonomyCount: number;
  orphanTopicCount: number;
  lowQualityCount: number;
  duplicateCandidateCount: number;
  duplicateGroups: number;
  archetypeClusters: number;
  issues: MetadataQualityIssue[];
}

function hasText(value: string | undefined): boolean {
  return Boolean(value && value.trim());
}

export function analyzeQuestionMetadataQuality(
  questions: BankQuestion[],
): MetadataQualityReport {
  const issues: MetadataQualityIssue[] = [];

  questions.forEach((question) => {
    const missing = [
      ["examSource", question.examSource],
      ["subject", question.subject],
      ["chapter", question.chapter],
      ["topic", question.topic],
      ["difficultyLevel", question.difficultyLevel],
      ["sourceType", question.sourceType],
    ].filter(([, value]) => !hasText(String(value ?? "")));

    if (missing.length > 0) {
      issues.push({
        questionId: question.id,
        type: "missing_metadata",
        severity: "error",
        message: `Missing metadata: ${missing.map(([field]) => field).join(", ")}`,
      });
    }

    if (!question.subtopic || question.conceptTags.length === 0) {
      issues.push({
        questionId: question.id,
        type: "incomplete_taxonomy",
        severity: "warning",
        message: "Subtopic or concept tags are incomplete.",
      });
    }

    if (
      question.examSource === "JEE Main" &&
      !isKnownTaxonomyPath({
        examType: "JEE_MAIN",
        subject: question.subject,
        chapter: question.chapter,
        topic: question.topic,
        subtopic: question.subtopic,
      })
    ) {
      issues.push({
        questionId: question.id,
        type: "orphan_topic",
        severity: "warning",
        message: "Question taxonomy path is not present in the JEE Main taxonomy.",
      });
    }

    if (
      question.questionText.trim().length < 20 ||
      (!question.solution && !question.solutionDetailed && !question.solutionShort) ||
      question.estimatedSolveTimeSeconds <= 0
    ) {
      issues.push({
        questionId: question.id,
        type: "low_quality_question",
        severity: "warning",
        message: "Question text, solution, or solve-time metadata needs review.",
      });
    }
  });

  const duplicateCandidates = findDuplicateCandidates(questions, 0.82);
  duplicateCandidates.forEach((candidate) => {
    issues.push({
      questionId: candidate.sourceQuestionId,
      type: "duplicate_candidate",
      severity: "warning",
      message: `Possible duplicate with ${candidate.duplicateQuestionId} (${candidate.similarityScore}).`,
    });
  });

  return {
    totalQuestions: questions.length,
    issueCount: issues.length,
    missingMetadataCount: issues.filter((issue) => issue.type === "missing_metadata").length,
    incompleteTaxonomyCount: issues.filter((issue) => issue.type === "incomplete_taxonomy").length,
    orphanTopicCount: issues.filter((issue) => issue.type === "orphan_topic").length,
    lowQualityCount: issues.filter((issue) => issue.type === "low_quality_question").length,
    duplicateCandidateCount: duplicateCandidates.length,
    duplicateGroups: prepareSimilarityGroups(questions).length,
    archetypeClusters: prepareArchetypeClusters(questions).length,
    issues,
  };
}
