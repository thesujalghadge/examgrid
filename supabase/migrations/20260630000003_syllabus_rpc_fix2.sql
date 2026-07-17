-- Fix RPC CTE parent_id mapping without metadata

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

    -- 2. Insert batch
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
        id, institute_id, batch_id, master_node_id, parent_id, node_type, name
    )
    SELECT 
        nm.new_id,
        p_institute_id,
        p_id,
        m.id,
        pm.new_id, -- Resolves to the newly generated parent UUID, or NULL
        m.node_type,
        m.name
    FROM public.master_syllabus_nodes m
    JOIN node_map nm ON nm.master_id = m.id
    LEFT JOIN node_map pm ON pm.master_id = m.parent_id
    WHERE m.syllabus_id = v_syllabus_id;

    RETURN p_id;
END;
$$;
