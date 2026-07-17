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

/**
 * V1 Metadata shape (legacy — read-only rendering support).
 */
export interface AiMetadataV1 {
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

/**
 * V3 Metadata shape (canonical — all new solutions).
 * Matches the SolutionV3 Zod schema.
 */
export interface AiMetadataV3 {
  keyIdea: string;
  conceptChips: string[];
  notations: { symbol: string; meaning: string }[];
  steps: {
    title: string;
    reasoning: string;
    equation?: string | null;
    result?: string | null;
  }[];
  finalAnswer: { value: string; option?: string | null };
  importantObservation?: string | null;
  commonMistakes?: string[] | null;
  shortcut?: string | null;
  takeaway: string;
  assumptions?: { assumption: string; validity: string; failure: string }[] | null;
  diagrams?: string[];
  graphs?: string[];
  tables?: string[];
  isTeacherReviewed?: boolean;
  teacherEdits?: { field: string; original: string; edited: string; editedBy: string; editedAt: string }[];
  subject: string;
  topic: string;
  subtopic: string;
  difficulty: string;
  questionType: string;
  primaryConcept: string;
  estimatedSolveTime: string;
  qualityScore?: {
    clarity: number;
    pedagogy: number;
    conciseness: number;
    repetition: number;
    notationConsistency: number;
    finalScore: number;
  };
  promptVersion: string;
  validationStatus: string;
}

/**
 * Union type for all AI metadata versions.
 * The renderer uses prompt_version / promptVersion to detect which shape to use.
 */
export type AiMetadata = AiMetadataV1 | AiMetadataV3 | Record<string, any>;

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
