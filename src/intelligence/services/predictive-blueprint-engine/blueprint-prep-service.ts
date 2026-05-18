import { getExamProfile } from "@/intelligence/config/exam-profiles";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import {
  createChapterMockBlueprint,
  type ExamBlueprint,
} from "@/lib/blueprint";

const BLUEPRINT_EXAM_TYPES = new Set([
  "JEE_MAIN",
  "JEE_ADVANCED",
  "MHT_CET",
  "NEET",
]);

function resolveBlueprintExamType(
  examProfileId: string,
): ExamBlueprint["examType"] {
  if (BLUEPRINT_EXAM_TYPES.has(examProfileId)) {
    return examProfileId as ExamBlueprint["examType"];
  }
  return "JEE_MAIN";
}

export interface PredictiveBlueprintInput {
  instituteId: string;
  examProfileId: string;
  chapter: string;
  subject: string;
  questionCount: number;
  pyqOnly?: boolean;
}

/**
 * Prepares predictive mock blueprints from approved PYQ pipeline output.
 * Delegates assembly rules to the existing blueprint engine.
 */
export function buildPredictiveBlueprint(
  input: PredictiveBlueprintInput,
): ExamBlueprint {
  const profile = getExamProfile(input.examProfileId);
  if (!profile) throw new Error(`Unknown exam profile: ${input.examProfileId}`);

  return createChapterMockBlueprint({
    id: `pred-${input.examProfileId}-${Date.now()}`,
    title: `${profile.label} · ${input.chapter} predictive mock`,
    examType: resolveBlueprintExamType(input.examProfileId),
    subject: input.subject,
    chapter: input.chapter,
    questionCount: input.questionCount,
    difficultyBalance: {
      easy: Math.floor(input.questionCount * 0.3),
      medium: Math.floor(input.questionCount * 0.45),
      hard: Math.ceil(input.questionCount * 0.25),
    },
    pyqOnly: input.pyqOnly ?? true,
  });
}

export function listApprovedPyqQuestionIds(
  instituteId: string,
  examProfileId: string,
): string[] {
  const repo = getIntelligenceRepository();
  return repo
    .listStructuredQuestions({
      instituteId,
      reviewStatus: "approved",
    })
    .filter((q) => q.examProfileId === examProfileId)
    .map((q) => q.id);
}
