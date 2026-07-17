-- Migration: AIP Phase 1 Database Schema

-- 1. Curricula
CREATE TABLE IF NOT EXISTS public.curricula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Curriculum Versions
CREATE TABLE IF NOT EXISTS public.curriculum_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID NOT NULL REFERENCES public.curricula(id) ON DELETE CASCADE,
    version_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'UPLOADED' CHECK (status IN ('UPLOADED', 'PARSING', 'REVIEW', 'PUBLISHED', 'ARCHIVED')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_curriculum_versions_curriculum_id ON public.curriculum_versions(curriculum_id);

-- 3. Curriculum Artifacts (Permanent Storage)
CREATE TABLE IF NOT EXISTS public.curriculum_artifacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.curriculum_versions(id) ON DELETE CASCADE,
    original_pdf_url TEXT,
    page_images_json JSONB DEFAULT '[]'::jsonb,
    ocr_text TEXT,
    parsed_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_curriculum_artifacts_version_id ON public.curriculum_artifacts(version_id);

-- 4. Curriculum Nodes
CREATE TABLE IF NOT EXISTS public.curriculum_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL REFERENCES public.curriculum_versions(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL CHECK (node_type IN ('SUBJECT', 'CHAPTER', 'TOPIC', 'SUBTOPIC')),
    canonical_code TEXT UNIQUE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_curriculum_nodes_version_id ON public.curriculum_nodes(version_id);
CREATE INDEX idx_curriculum_nodes_parent_id ON public.curriculum_nodes(parent_id);

-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 5. Curriculum Node Embeddings (Generated on PUBLISH)
CREATE TABLE IF NOT EXISTS public.curriculum_node_embeddings (
    node_id UUID PRIMARY KEY REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    embedding_model TEXT NOT NULL,
    embedding_version TEXT NOT NULL,
    embedding public.vector(768) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Exam Blueprints & Weights
CREATE TABLE IF NOT EXISTS public.exam_blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_version_id UUID NOT NULL REFERENCES public.curriculum_versions(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exam_blueprints_version_id ON public.exam_blueprints(curriculum_version_id);

CREATE TABLE IF NOT EXISTS public.exam_blueprint_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES public.exam_blueprints(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    weight_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (blueprint_id, node_id)
);

-- 7. Question Node Mappings
CREATE TABLE IF NOT EXISTS public.question_node_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES public.curriculum_nodes(id) ON DELETE CASCADE,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    weight NUMERIC(5,2) DEFAULT 1.0,
    confidence NUMERIC(4,3),
    is_verified BOOLEAN NOT NULL DEFAULT false,
    verified_by UUID REFERENCES auth.users(id),
    verified_at TIMESTAMPTZ,
    provider TEXT NOT NULL,
    provider_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (question_id, node_id)
);
CREATE INDEX idx_question_node_mappings_question_id ON public.question_node_mappings(question_id);
CREATE INDEX idx_question_node_mappings_node_id ON public.question_node_mappings(node_id);
CREATE INDEX idx_question_node_mappings_verified ON public.question_node_mappings(is_verified);

-- 8. Question Classification Events
CREATE TABLE IF NOT EXISTS public.question_classification_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    top_candidates_json JSONB DEFAULT '[]'::jsonb,
    prompt_used TEXT,
    raw_response TEXT,
    chosen_node_ids JSONB DEFAULT '[]'::jsonb,
    confidence NUMERIC(4,3),
    provider TEXT,
    latency_ms INTEGER,
    token_usage_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_question_classification_events_question_id ON public.question_classification_events(question_id);

-- Enable RLS
ALTER TABLE public.curricula ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curriculum_node_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_blueprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_blueprint_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_node_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_classification_events ENABLE ROW LEVEL SECURITY;

-- Dev Policies (Allow all for Phase 1 dev)
CREATE POLICY "dev_curricula_all" ON public.curricula FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_curriculum_versions_all" ON public.curriculum_versions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_curriculum_artifacts_all" ON public.curriculum_artifacts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_curriculum_nodes_all" ON public.curriculum_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_curriculum_node_embeddings_all" ON public.curriculum_node_embeddings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_exam_blueprints_all" ON public.exam_blueprints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_exam_blueprint_weights_all" ON public.exam_blueprint_weights FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_question_node_mappings_all" ON public.question_node_mappings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_question_classification_events_all" ON public.question_classification_events FOR ALL USING (true) WITH CHECK (true);
