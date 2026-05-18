/**
 * ExamGrid Academic Intelligence Layer
 * PYQ ingestion → segmentation → AI solutions → verification → metadata → difficulty
 */

export { EXAM_PROFILES, getExamProfile, listExamProfiles } from "@/intelligence/config/exam-profiles";
export { getIntelligenceEnv } from "@/intelligence/config/env";
export { getIntelligenceRepository } from "@/intelligence/repositories/provider";
export { uploadPyqSource, runExtractionJob } from "@/intelligence/services/pyq-ingestion/ingestion-service";
export { runSegmentationJob, segmentBlock, splitRawTextIntoBlocks } from "@/intelligence/services/question-parser/parser-service";
export { generateSolution, runSolutionJob } from "@/intelligence/services/ai-solution-engine/solution-service";
export { verifySolution } from "@/intelligence/services/verification-engine/verification-service";
export { extractMetadata } from "@/intelligence/services/metadata-engine/metadata-service";
export { computeDifficultySignal, runDifficultyJob } from "@/intelligence/services/difficulty-engine/difficulty-service";
export {
  buildPredictiveBlueprint,
  listApprovedPyqQuestionIds,
} from "@/intelligence/services/predictive-blueprint-engine/blueprint-prep-service";
export {
  listQuestionsForReview,
  updateQuestionReview,
  updateSolutionReview,
  publishApprovedQuestion,
} from "@/intelligence/services/review/review-service";
export { getLlmProvider, listLlmProviders } from "@/intelligence/providers/provider-registry";
export type * from "@/intelligence/types/pipeline";
