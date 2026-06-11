export interface SolutionGenerationInput {
  questionId: string;
  instituteId: string;
  rawText: string;
  structuredOptions: any[];
  correctAnswer?: string;
  extractedSubject?: string;
  extractedChapter?: string;
}

export interface AiMetadata {
  taxonomy: {
    subject?: string;
    topic?: string;
    subtopic?: string;
    concepts?: string[];
  };
  cognitiveLevel?: string;
  difficulty?: number;
  mistakePatterns?: string[];
  learningObjective?: string;
  confidenceScore?: number;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface SolutionProviderResult {
  markdownSolution: string;
  finalAnswer?: string;
  answerConfidence?: number;
  aiMetadata: AiMetadata;
  promptVersion: string;
  tokenUsage: TokenUsage;
}

export interface SolutionProvider {
  name: string;
  modelName: string;
  generateSolution(
    input: SolutionGenerationInput,
    promptVersion: string
  ): Promise<SolutionProviderResult>;
}
