export interface ClassificationResult {
  node_id: string;
  confidence: number;
  reasoning: string;
  evidence: {
    keywords: string[];
    formulae: string[];
  };
  provider: string;
  model: string;
  prompt_version: string;
  prompt_used?: string;
  raw_response?: string;
}

export interface CandidateNode {
  node_id: string;
  similarity_score: number;
  name?: string;
  node_type?: string;
}

export interface ClassifyRequest {
  query_text: string;
  candidates: CandidateNode[];
}

export interface ClassificationProvider {
  classify(req: ClassifyRequest): Promise<ClassificationResult>;
}
