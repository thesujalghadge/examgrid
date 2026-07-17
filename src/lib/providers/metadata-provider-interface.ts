export interface ClassificationResult {
  primary_node: string;
  secondary_nodes: string[];
  confidence: number;
  reasoning: string;
  evidence: {
    keywords: string[];
    formulae: string[];
    entities: string[];
    diagram_features: string[];
    reasoning: string[];
  };
  provider: string;
  model: string;
  prompt_version: string;
}

export interface CandidateNode {
  node_id: string;
  similarity_score: number;
  rank: number;
  description?: string; // Optional metadata for context
  canonical_code?: string;
  path?: string;
}

export interface ClassifyRequest {
  question_text: string;
  rich_context: string;
  candidates: CandidateNode[];
}

export interface MetadataProvider {
  classify(req: ClassifyRequest): Promise<ClassificationResult>;
}
