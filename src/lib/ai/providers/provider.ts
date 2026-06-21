export interface SolutionGenerationInput {
  questionId: string;
  instituteId: string;
  rawText: string;
  structuredOptions: any[];
  correctAnswer?: string;
  extractedSubject?: string;
  extractedChapter?: string;
  imageUrl?: string;
  questionType?: string;
}

export interface AiMetadata {
  subject: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  question_type: string;
  primary_concept: string;
  secondary_concept: string;
  quick_approach: string;
  essential_steps: string[];
  final_answer: string;
  prompt_version: string;
  validation_status: string;
}

export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

export interface SolutionProviderResult {
  markdownSolution: string;
  finalAnswer: string;
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
