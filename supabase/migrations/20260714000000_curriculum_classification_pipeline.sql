-- Migration: Curriculum Classification Pipeline

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 1. Curriculum Node Embeddings
CREATE TABLE IF NOT EXISTS public.curriculum_node_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id UUID NOT NULL REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    embedding_model TEXT NOT NULL DEFAULT 'text-embedding-004',
    embedding_version TEXT NOT NULL DEFAULT 'v1',
    embedding public.vector(768) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(node_id, embedding_model, embedding_version)
);

CREATE INDEX idx_curriculum_node_embeddings_node ON public.curriculum_node_embeddings(node_id);

-- 2. Classification Jobs
CREATE TABLE IF NOT EXISTS public.classification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL, -- e.g., 'EMBED_CURRICULUM', 'CLASSIFY_QUESTION'
    status TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    worker_id TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);
CREATE INDEX idx_classification_jobs_status ON public.classification_jobs(status);

-- 3. Question Node Mappings (Append Only for History)
DROP TABLE IF EXISTS public.question_node_mappings CASCADE;
CREATE TABLE IF NOT EXISTS public.question_node_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    topic_id UUID REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    subtopic_id UUID REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    confidence NUMERIC(5,4),
    status TEXT NOT NULL DEFAULT 'AI_CLASSIFIED' CHECK (status IN ('AI_CLASSIFIED', 'PENDING_REVIEW', 'VERIFIED', 'REJECTED')),
    structured_evidence JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT true,
    idempotency_key TEXT UNIQUE,
    retrieval_candidate_rank INTEGER,
    retrieval_latency_ms INTEGER,
    retrieval_candidate_count INTEGER,
    classification_provider TEXT,
    classification_model TEXT,
    prompt_version TEXT,
    embedding_model TEXT,
    verified_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_question_node_mappings_qid ON public.question_node_mappings(question_id);
CREATE INDEX idx_question_node_mappings_active ON public.question_node_mappings(question_id) WHERE is_active = true;

-- 4. RPC for Vector Retrieval (Top-K Leaf Nodes Only, Version Isolated)
CREATE OR REPLACE FUNCTION public.retrieve_curriculum_nodes(
  query_embedding public.vector(768),
  match_count int,
  target_version_id uuid,
  target_embedding_model text DEFAULT 'text-embedding-004'
)
RETURNS TABLE (
  node_id uuid,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.node_id,
    1 - (e.embedding <=> query_embedding) as similarity
  FROM public.curriculum_node_embeddings e
  JOIN public.curriculum_nodes n ON n.id = e.node_id
  WHERE n.version_id = target_version_id
  AND e.is_active = true
  AND e.embedding_model = target_embedding_model
  AND NOT EXISTS (
    SELECT 1 FROM public.curriculum_nodes child WHERE child.parent_id = n.id
  )
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Enable RLS
ALTER TABLE public.curriculum_node_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_node_mappings ENABLE ROW LEVEL SECURITY;

-- Dev Policies (Allow all for Phase 1 dev)
CREATE POLICY "dev_cne_all" ON public.curriculum_node_embeddings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_cj_all" ON public.classification_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_qnm_all" ON public.question_node_mappings FOR ALL USING (true) WITH CHECK (true);
