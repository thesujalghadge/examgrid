import { z } from "zod";

export const blueprintDifficultyMixSchema = z.object({
  easy: z.number().int().nonnegative().default(0),
  medium: z.number().int().nonnegative().default(0),
  hard: z.number().int().nonnegative().default(0),
});

export const blueprintTopicTargetSchema = z.object({
  subject: z.string().min(1),
  chapter: z.string().optional(),
  topic: z.string().optional(),
  questionCount: z.number().int().nonnegative(),
});

export const examBlueprintSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  examType: z.enum(["JEE_MAIN", "JEE_ADVANCED", "MHT_CET", "NEET"]),
  mockType: z
    .enum(["chapter", "topic", "difficulty_balanced", "pyq_only", "mixed", "weighted"])
    .default("mixed"),
  totalQuestions: z.number().int().positive(),
  subjectWeightage: z.record(z.string(), z.number().int().nonnegative()),
  topicDistribution: z.array(blueprintTopicTargetSchema).default([]),
  difficultyBalance: blueprintDifficultyMixSchema,
  pyqOnly: z.boolean().default(false),
  sourceTypes: z.array(z.enum(["PYQ", "generated", "institute", "custom"])).default([]),
});

export type BlueprintDifficultyMix = z.infer<typeof blueprintDifficultyMixSchema>;
export type BlueprintTopicTarget = z.infer<typeof blueprintTopicTargetSchema>;
export type ExamBlueprint = z.infer<typeof examBlueprintSchema>;
