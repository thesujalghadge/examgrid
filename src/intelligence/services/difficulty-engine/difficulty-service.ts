import { intelligenceId, nowIso } from "@/intelligence/lib/ids";
import { getIntelligenceRepository } from "@/intelligence/repositories/provider";
import type { DifficultyRecord } from "@/intelligence/repositories/interfaces/intelligence-repository";
import type { DifficultySignal } from "@/intelligence/types/pipeline";

export interface DifficultyAnalyticsInput {
  studentAccuracy?: number;
  medianSolveTimeSeconds?: number;
  skipRate?: number;
  negativeMarkingRate?: number;
  expectedSolveTimeSeconds?: number;
}

/**
 * Dynamic difficulty scoring — analytics fields are optional until
 * attempt analytics are wired from the CBT layer.
 */
export function computeDifficultySignal(
  input: DifficultyAnalyticsInput & { staticPrior?: number },
): DifficultySignal {
  const staticScore = input.staticPrior ?? 0.5;
  const accuracyFactor =
    input.studentAccuracy !== undefined
      ? 1 - input.studentAccuracy
      : undefined;
  const timeFactor =
    input.medianSolveTimeSeconds !== undefined &&
    input.expectedSolveTimeSeconds
      ? Math.min(
          1,
          input.medianSolveTimeSeconds / input.expectedSolveTimeSeconds,
        )
      : undefined;
  const skipFactor = input.skipRate;
  const negativeFactor = input.negativeMarkingRate;

  const factors = [accuracyFactor, timeFactor, skipFactor, negativeFactor].filter(
    (f): f is number => f !== undefined,
  );

  const dynamic =
    factors.length > 0
      ? factors.reduce((a, b) => a + b, 0) / factors.length
      : staticScore;

  const compositeScore = Math.min(
    1,
    Math.max(0, staticScore * 0.4 + dynamic * 0.6),
  );

  return {
    staticScore,
    studentAccuracy: input.studentAccuracy,
    medianSolveTimeSeconds: input.medianSolveTimeSeconds,
    skipRate: input.skipRate,
    negativeMarkingRate: input.negativeMarkingRate,
    compositeScore,
    sampleSize: factors.length > 0 ? 1 : 0,
  };
}

export async function runDifficultyJob(
  structuredQuestionId: string,
): Promise<DifficultyRecord> {
  const repo = getIntelligenceRepository();
  const question = repo.getStructuredQuestion(structuredQuestionId);
  if (!question) {
    throw new Error(`Structured question not found: ${structuredQuestionId}`);
  }

  const metadata = repo.getMetadataByQuestion(structuredQuestionId);
  const staticPrior =
    metadata?.metadata.difficulty === "hard"
      ? 0.8
      : metadata?.metadata.difficulty === "easy"
        ? 0.25
        : 0.5;

  const signal = computeDifficultySignal({
    staticPrior,
    expectedSolveTimeSeconds: 120,
  });

  const now = nowIso();
  const record: DifficultyRecord = {
    id: intelligenceId("diff"),
    structuredQuestionId,
    signal,
    createdAt: now,
    updatedAt: now,
  };

  repo.saveDifficulty(record);
  return record;
}
