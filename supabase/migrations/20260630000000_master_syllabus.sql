-- Migration: Master Syllabus Infrastructure

-- 1. Create master_syllabi
CREATE TABLE IF NOT EXISTS public.master_syllabi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    exam_type TEXT NOT NULL, -- e.g., 'JEE', 'NEET'
    version TEXT NOT NULL DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 2. Create master_syllabus_nodes
CREATE TABLE IF NOT EXISTS public.master_syllabus_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    syllabus_id UUID NOT NULL REFERENCES public.master_syllabi(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.master_syllabus_nodes(id) ON DELETE CASCADE,
    node_type TEXT NOT NULL CHECK (node_type IN ('SUBJECT', 'CHAPTER', 'TOPIC', 'SUBTOPIC')),
    name TEXT NOT NULL,
    order_index INTEGER DEFAULT 0 NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS master_syllabus_nodes_syllabus_idx ON public.master_syllabus_nodes(syllabus_id);
CREATE INDEX IF NOT EXISTS master_syllabus_nodes_parent_idx ON public.master_syllabus_nodes(parent_id);

-- 3. Add master_node_id to batch_syllabus_nodes
ALTER TABLE public.batch_syllabus_nodes
ADD COLUMN IF NOT EXISTS master_node_id UUID REFERENCES public.master_syllabus_nodes(id) ON DELETE SET NULL;
