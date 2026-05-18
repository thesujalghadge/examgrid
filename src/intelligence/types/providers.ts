import type { QuestionMetadata, StructuredSolution } from "@/intelligence/types/pipeline";

export type LlmProviderId = "openai" | "gemini" | string;

export interface LlmMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
  metadata?: Record<string, string>;
}

export interface LlmCompletionResponse {
  providerId: LlmProviderId;
  model: string;
  content: string;
  raw: unknown;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export interface SolutionGenerationInput {
  questionText: string;
  options: Array<{ label: string; text: string }>;
  correctAnswer?: string;
  examProfileId: string;
  subject?: string;
}

export interface SolutionGenerationOutput {
  structured: StructuredSolution;
  rawResponse: string;
  providerId: LlmProviderId;
  model: string;
  confidence: number;
}

export interface VerificationInput {
  questionText: string;
  primarySolution: StructuredSolution;
  primaryProviderId: LlmProviderId;
  verifierProviderId: LlmProviderId;
}

export interface MetadataExtractionInput {
  questionText: string;
  solution?: StructuredSolution;
  examProfileId: string;
}

export interface MetadataExtractionOutput {
  metadata: QuestionMetadata;
  rawResponse: string;
  providerId: LlmProviderId;
  confidence: number;
}

export interface LlmProvider {
  readonly id: LlmProviderId;
  readonly displayName: string;
  isConfigured(): boolean;
  complete(request: LlmCompletionRequest): Promise<LlmCompletionResponse>;
}
