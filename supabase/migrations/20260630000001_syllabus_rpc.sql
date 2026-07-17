-- Migration: Syllabus RPC and Hierarchy Cloning Updates

-- 1. Enforce master_syllabi constraints
ALTER TABLE public.master_syllabi
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Ensure version is not empty
ALTER TABLE public.master_syllabi
DROP CONSTRAINT IF EXISTS master_syllabi_version_check;
ALTER TABLE public.master_syllabi
ADD CONSTRAINT master_syllabi_version_check CHECK (version <> '');

-- Ensure uniqueness of course_type + version combination
ALTER TABLE public.master_syllabi
DROP CONSTRAINT IF EXISTS master_syllabi_exam_type_version_key;

ALTER TABLE public.master_syllabi
ADD CONSTRAINT master_syllabi_exam_type_version_key UNIQUE (exam_type, version);

-- 2. Enhance batches table with syllabus tracking
ALTER TABLE public.batches
ADD COLUMN IF NOT EXISTS syllabus_id UUID,
ADD COLUMN IF NOT EXISTS syllabus_version TEXT;

ALTER TABLE public.batches
DROP CONSTRAINT IF EXISTS fk_batches_syllabus;

ALTER TABLE public.batches
ADD CONSTRAINT fk_batches_syllabus FOREIGN KEY (syllabus_id) REFERENCES public.master_syllabi(id);

-- 3. Create the RPC for server-authoritative batch creation
CREATE OR REPLACE FUNCTION public.create_batch_with_syllabus(
    p_id UUID,
    p_institute_id UUID,
    p_name TEXT,
    p_course_type TEXT,
    p_academic_year TEXT,
    p_is_active BOOLEAN
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_syllabus_id UUID;
    v_syllabus_version TEXT;
BEGIN
    -- 1. Resolve syllabus BEFORE inserting the batch (fail fast)
    SELECT id, version INTO v_syllabus_id, v_syllabus_version
    FROM public.master_syllabi
    WHERE exam_type = p_course_type AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_syllabus_id IS NULL THEN
        RAISE EXCEPTION 'No active syllabus found for course type %', p_course_type;
    END IF;

    -- 2. Insert batch (transaction will rollback if this fails, e.g., duplicate name constraint)
    INSERT INTO public.batches (
        id, institute_id, name, course_type, academic_year, is_active, syllabus_id, syllabus_version
    ) VALUES (
        p_id, p_institute_id, p_name, p_course_type, p_academic_year, p_is_active, v_syllabus_id, v_syllabus_version
    )
    ON CONFLICT (institute_id, name, academic_year) DO UPDATE
    SET 
        is_active = EXCLUDED.is_active
    RETURNING id INTO p_id;

    -- 3. Check for duplicates
    IF EXISTS (
        SELECT 1 
        FROM public.batch_syllabus_nodes 
        WHERE batch_id = p_id
    ) THEN
        RAISE EXCEPTION 'Batch % already has syllabus nodes populated. Do not clone twice.', p_id;
    END IF;

    -- 4. Clone Syllabus using a CTE (no temp tables)
    WITH node_map AS (
        SELECT 
            id AS master_id,
            gen_random_uuid() AS new_id
        FROM public.master_syllabus_nodes
        WHERE syllabus_id = v_syllabus_id
    )
    INSERT INTO public.batch_syllabus_nodes (
        id, institute_id, batch_id, master_node_id, parent_id, node_type, name, metadata
    )
    SELECT 
        nm.new_id,
        p_institute_id,
        p_id,
        m.id,
        pm.new_id, -- Resolves to the newly generated parent UUID, or NULL
        m.node_type,
        m.name,
        m.metadata
    FROM public.master_syllabus_nodes m
    JOIN node_map nm ON nm.master_id = m.id
    LEFT JOIN node_map pm ON pm.master_id = m.parent_id
    WHERE m.syllabus_id = v_syllabus_id;

    RETURN p_id;
END;
$$;
