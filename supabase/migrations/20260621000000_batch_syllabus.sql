-- Batch Syllabus System Migration

CREATE TABLE IF NOT EXISTS public.batch_syllabus_nodes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    parent_id uuid REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    node_type text NOT NULL CHECK (node_type IN ('SUBJECT', 'CHAPTER', 'TOPIC', 'SUBTOPIC')),
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS batch_syllabus_nodes_batch_idx ON public.batch_syllabus_nodes(batch_id);
CREATE INDEX IF NOT EXISTS batch_syllabus_nodes_parent_idx ON public.batch_syllabus_nodes(parent_id);
CREATE INDEX IF NOT EXISTS batch_syllabus_nodes_type_idx ON public.batch_syllabus_nodes(node_type);

CREATE TABLE IF NOT EXISTS public.question_syllabus_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    question_id text NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
    syllabus_subject_id uuid REFERENCES public.batch_syllabus_nodes(id) ON DELETE SET NULL,
    syllabus_chapter_id uuid REFERENCES public.batch_syllabus_nodes(id) ON DELETE SET NULL,
    syllabus_topic_id uuid REFERENCES public.batch_syllabus_nodes(id) ON DELETE SET NULL,
    syllabus_subtopic_id uuid REFERENCES public.batch_syllabus_nodes(id) ON DELETE SET NULL,
    mapping_confidence numeric(5,2) NOT NULL DEFAULT 0,
    mapping_method text NOT NULL CHECK (mapping_method IN ('AI_FUZZY', 'MANUAL_CORRECTION', 'AUTO_RULE')),
    is_unmapped boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (batch_id, question_id)
);

CREATE INDEX IF NOT EXISTS question_syllabus_mappings_batch_idx ON public.question_syllabus_mappings(batch_id);
CREATE INDEX IF NOT EXISTS question_syllabus_mappings_question_idx ON public.question_syllabus_mappings(question_id);
CREATE INDEX IF NOT EXISTS question_syllabus_mappings_unmapped_idx ON public.question_syllabus_mappings(institute_id, is_unmapped);

CREATE TABLE IF NOT EXISTS public.syllabus_mapping_rules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id uuid NOT NULL REFERENCES public.institutes(id) ON DELETE CASCADE,
    batch_id uuid NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
    ai_subject text NOT NULL,
    ai_chapter text NOT NULL,
    ai_topic text,
    target_syllabus_subject_id uuid REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    target_syllabus_chapter_id uuid REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    target_syllabus_topic_id uuid REFERENCES public.batch_syllabus_nodes(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (batch_id, ai_subject, ai_chapter, ai_topic)
);

CREATE INDEX IF NOT EXISTS syllabus_mapping_rules_batch_idx ON public.syllabus_mapping_rules(batch_id);

-- RLS
ALTER TABLE public.batch_syllabus_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_syllabus_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.syllabus_mapping_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dev_batch_syllabus_nodes_all" ON public.batch_syllabus_nodes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_question_syllabus_mappings_all" ON public.question_syllabus_mappings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "dev_syllabus_mapping_rules_all" ON public.syllabus_mapping_rules FOR ALL USING (true) WITH CHECK (true);

-- End of migration
