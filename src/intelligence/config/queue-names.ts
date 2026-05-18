export const INTELLIGENCE_QUEUE_NAMES = {
  EXTRACTION: "intelligence-extraction",
  SEGMENTATION: "intelligence-segmentation",
  AI_SOLUTION: "intelligence-ai-solution",
  VERIFICATION: "intelligence-verification",
  METADATA: "intelligence-metadata",
  DIFFICULTY: "intelligence-difficulty",
} as const;

export type IntelligenceQueueName =
  (typeof INTELLIGENCE_QUEUE_NAMES)[keyof typeof INTELLIGENCE_QUEUE_NAMES];
