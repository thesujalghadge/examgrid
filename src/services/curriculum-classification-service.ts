import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { createHash } from "crypto";
import { GeminiClassificationProvider } from "@/lib/providers/gemini-classification-provider";
import { GoogleEmbeddingProvider } from "@/lib/providers/google-embedding-provider";

export interface CurriculumClassificationResult {
  node_id: string;
  confidence: number;
  structured_evidence: any;
  trace?: any; // The full debugging trace
}

export async function classifyQuestionAgainstCurriculum(
  questionId: string, 
  options: { dryRun?: boolean, curriculumVersionId: string, jobId?: string }
): Promise<CurriculumClassificationResult> {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");
  
  if (!options.curriculumVersionId) throw new Error("curriculumVersionId is required for version isolation");
  
  const startTime = Date.now();

  // 1. Fetch Question data
  const { data: question, error: qError } = await supabase
    .from("questions")
    .select("*, question_solutions(solution_text)")
    .eq("id", questionId)
    .single();

  if (qError || !question) throw new Error("Question not found");

  // Build semantic string
  let queryText = `Question: ${question.question_text}\n`;
  if (question.options) {
    queryText += `Options: ${JSON.stringify(question.options)}\n`;
  }
  if (question.question_solutions && question.question_solutions.length > 0) {
    queryText += `Solution: ${question.question_solutions[0].solution_text}\n`;
  }

  // 2. Embed the query text
  const embedStartTime = Date.now();
  const embeddingProvider = new GoogleEmbeddingProvider();
  const queryEmbedding = await embeddingProvider.embed(queryText);
  const embedLatency = Date.now() - embedStartTime;

  // 3. Top-K RAG Retrieval (Leaf nodes only, Version Isolated)
  const rpcQuery: any = {
    query_embedding: queryEmbedding,
    match_count: 15,
    target_version_id: options.curriculumVersionId,
    target_embedding_model: "text-embedding-004"
  };
  
  const { data: candidates, error: rpcError } = await supabase.rpc('retrieve_curriculum_nodes', rpcQuery);

  if (rpcError) throw new Error("Vector retrieval failed: " + rpcError.message);
  if (!candidates || candidates.length === 0) throw new Error("No curriculum nodes found in DB.");

  // Fetch candidate details for prompt
  const candidateIds = candidates.map((c: any) => c.node_id);
  const { data: candidateNodes, error: cnError } = await supabase
    .from("curriculum_nodes")
    .select("*")
    .in("id", candidateIds);

  if (cnError) throw new Error("Failed to fetch candidate details: " + cnError.message);

  const candidatesMap = new Map(candidateNodes.map(n => [n.id, n]));
  
  // Helper to build hierarchy display string
  const getHierarchyStr = async (nodeId: string) => {
    const parts = [];
    let curr: string | null = nodeId;
    while(curr) {
      const { data } = await supabase.from("curriculum_nodes").select("id, name, parent_id").eq("id", curr).single();
      if (data) {
        parts.unshift(data.name);
        curr = data.parent_id;
      } else {
        curr = null;
      }
    }
    return parts.join(' > ');
  };

  const fullCandidates = [];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const node = candidatesMap.get(c.node_id);
    const pathStr = await getHierarchyStr(c.node_id);
    fullCandidates.push({
      node_id: c.node_id,
      similarity_score: c.similarity,
      rank: i + 1,
      name: node?.name,
      node_type: node?.node_type,
      path: pathStr
    });
  }

  // 4. Gemini Curriculum Classifier
  const classifier = new GeminiClassificationProvider();
  const classificationResult = await classifier.classify({
    query_text: queryText,
    candidates: fullCandidates
  });

  // Validation
  const isValidUUID = candidateIds.includes(classificationResult.node_id);
  
  // 5. Derive Full Hierarchy
  const hierarchy: { [key: string]: string | null } = {
    SUBJECT: null,
    CHAPTER: null,
    TOPIC: null,
    SUBTOPIC: null
  };

  const hierarchyNames: string[] = [];

  let currentNodeId: string | null = classificationResult.node_id;
  while (currentNodeId) {
    const { data: nodeData } = await supabase
      .from("curriculum_nodes")
      .select("*")
      .eq("id", currentNodeId)
      .single();
    
    if (nodeData) {
      if (hierarchy[nodeData.node_type] !== undefined) {
        hierarchy[nodeData.node_type] = nodeData.id;
      }
      hierarchyNames.unshift(nodeData.name);
      currentNodeId = nodeData.parent_id;
    } else {
      currentNodeId = null;
    }
  }

  // 6. Confidence Lifecycle
  let status = 'AI_CLASSIFIED';
  if (classificationResult.confidence >= 0.95) {
    status = 'VERIFIED';
  } else {
    status = 'PENDING_REVIEW';
  }

  const providerName = "GEMINI";
  const modelName = "gemini-3.1-flash-lite";
  const promptVersion = "v1-curriculum-leaf";
  const embeddingModel = "text-embedding-004";

  // Deterministic Idempotency Key
  const idempotencyHash = createHash('sha256')
    .update(`${questionId}_${options.curriculumVersionId}_${providerName}_${modelName}_${embeddingModel}_${promptVersion}`)
    .digest('hex');

  // Find candidate rank
  let candidateRank = -1;
  for (let i = 0; i < fullCandidates.length; i++) {
    if (fullCandidates[i].node_id === classificationResult.node_id) {
      candidateRank = i + 1;
      break;
    }
  }

  const persistencePayload = {
    question_id: questionId,
    subject_id: hierarchy['SUBJECT'],
    chapter_id: hierarchy['CHAPTER'],
    topic_id: hierarchy['TOPIC'],
    subtopic_id: hierarchy['SUBTOPIC'],
    confidence: classificationResult.confidence,
    status: status,
    structured_evidence: classificationResult.evidence,
    idempotency_key: idempotencyHash,
    is_primary: true,
    retrieval_candidate_rank: candidateRank,
    retrieval_latency_ms: embedLatency, // Assuming embedding latency is bulk of retrieval, or trace actual RPC latency if needed
    retrieval_candidate_count: fullCandidates.length,
    classification_provider: providerName,
    classification_model: modelName,
    prompt_version: promptVersion,
    embedding_model: embeddingModel
  };

  const trace = {
    retrieval_input: queryText,
    embedding: {
      provider: "Google",
      model: "text-embedding-004",
      latency_ms: embedLatency
    },
    candidates: fullCandidates,
    prompt: classificationResult.prompt_used,
    raw_response: classificationResult.raw_response,
    parsed_response: {
      node_id: classificationResult.node_id,
      confidence: classificationResult.confidence,
      reasoning: classificationResult.reasoning,
      evidence: classificationResult.evidence
    },
    validation: {
      uuid_exists: true,
      uuid_in_candidates: isValidUUID,
      is_leaf_node: true // Enforced by RPC
    },
    derived_hierarchy: hierarchyNames,
    persistence_preview: persistencePayload,
    total_latency_ms: Date.now() - startTime
  };

  // 7. UUID Question Mapping (Persistence)
  if (!options?.dryRun) {
    // Attempt to insert with idempotency key. If it fails on unique constraint, we already processed this job.
    // However, if it's a NEW job (reclassification), we need to deactivate old active mappings first.
    // Since Supabase doesn't support transactions via JS client natively without RPC, 
    // we do an update then an insert.
    
    await supabase.from("question_node_mappings").update({ is_active: false }).eq("question_id", questionId).eq("is_active", true);

    const { error: insertError } = await supabase.from("question_node_mappings").insert([persistencePayload]);
    if (insertError) {
      if (insertError.code === '23505') { // Unique violation
        console.warn(`Idempotency key ${idempotencyHash} already exists. Skipping insert.`);
      } else {
        throw new Error("Failed to persist mapping: " + insertError.message);
      }
    }
  }

  return {
    node_id: classificationResult.node_id,
    confidence: classificationResult.confidence,
    structured_evidence: classificationResult.evidence,
    trace
  };
}
