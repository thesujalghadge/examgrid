import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";

export async function getPendingReviews(curriculumId?: string) {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");

  let query = supabase
    .from("question_node_mappings")
    .select(`
      id,
      question_id,
      questions ( question_text ),
      subject_id,
      chapter_id,
      topic_id,
      subtopic_id,
      confidence,
      structured_evidence,
      created_at
    `)
    .eq("is_active", true)
    .eq("status", "PENDING_REVIEW");

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function verifyMapping(params: {
  existingMappingId: string;
  teacherId: string;
  overrideNodeId?: string; // If provided, the teacher overrode the AI's leaf node
  isRejected?: boolean;
}) {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");

  // 1. Fetch existing mapping
  const { data: oldMapping, error: fetchError } = await supabase
    .from("question_node_mappings")
    .select("*")
    .eq("id", params.existingMappingId)
    .single();

  if (fetchError || !oldMapping) throw new Error("Mapping not found");

  // 2. Mark old mapping inactive
  await supabase
    .from("question_node_mappings")
    .update({ is_active: false })
    .eq("id", params.existingMappingId);

  // 3. Derive new hierarchy if there's an override, else copy old hierarchy
  let hierarchy = {
    subject_id: oldMapping.subject_id,
    chapter_id: oldMapping.chapter_id,
    topic_id: oldMapping.topic_id,
    subtopic_id: oldMapping.subtopic_id
  };

  if (params.overrideNodeId && !params.isRejected) {
    hierarchy = { subject_id: null, chapter_id: null, topic_id: null, subtopic_id: null };
    let currentNodeId: string | null = params.overrideNodeId;
    
    while (currentNodeId) {
      const { data: nodeData } = await supabase
        .from("curriculum_nodes")
        .select("*")
        .eq("id", currentNodeId)
        .single();
      
      if (nodeData) {
        if (Object.keys(hierarchy).includes(`${nodeData.node_type.toLowerCase()}_id`)) {
          (hierarchy as any)[`${nodeData.node_type.toLowerCase()}_id`] = nodeData.id;
        }
        currentNodeId = nodeData.parent_id;
      } else {
        currentNodeId = null;
      }
    }
  }

  // 4. Determine new status
  const newStatus = params.isRejected ? 'REJECTED' : 'VERIFIED';

  // 5. Append new mapping
  const { data: newMapping, error: insertError } = await supabase
    .from("question_node_mappings")
    .insert([{
      question_id: oldMapping.question_id,
      subject_id: hierarchy.subject_id,
      chapter_id: hierarchy.chapter_id,
      topic_id: hierarchy.topic_id,
      subtopic_id: hierarchy.subtopic_id,
      confidence: oldMapping.confidence, // Keep original confidence for metrics
      status: newStatus,
      structured_evidence: oldMapping.structured_evidence,
      is_active: true,
      verified_by: params.teacherId
    }])
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  // 6. Insert mapping changed event to background_jobs.
  // Since mapping applies to the bank_question, we might need to get the institute_id
  // from the question or default it. Since background_jobs requires it, we'll fetch it from questions.
  const { data: qData } = await supabase.from('questions').select('institute_id').eq('id', newMapping.question_id).single();

  await supabase.from('background_jobs').insert([{
    institute_id: qData?.institute_id || '00000000-0000-0000-0000-000000000000',
    job_type: 'MAPPING_CHANGED',
    payload: {
      questionId: newMapping.question_id,
      oldMapping,
      newMapping
    }
  }]);

  return newMapping;
}
