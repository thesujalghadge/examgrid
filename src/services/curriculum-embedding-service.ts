import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getPlatformSetting } from "@/services/platform-settings-service";

export async function processCurriculumEmbeddingJob(jobId: string) {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");

  const { data: job, error: jobError } = await supabase
    .from("classification_jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (jobError || !job) throw new Error("Job not found");
  
  if (job.status !== 'QUEUED' && job.status !== 'FAILED') {
    return;
  }

  await supabase.from("classification_jobs").update({ status: 'PROCESSING', started_at: new Date().toISOString() }).eq("id", jobId);

  try {
    const versionId = job.payload.versionId;
    if (!versionId) throw new Error("Missing versionId in payload");

    // Fetch curriculum nodes
    const { data: nodes, error: nodesError } = await supabase
      .from("curriculum_nodes")
      .select("*")
      .eq("version_id", versionId)
      .order("order_index", { ascending: true });

    if (nodesError) throw new Error(nodesError.message);

    let apiKey = await getPlatformSetting("GEMINI_API_KEY");
    if (!apiKey) apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not found");

    const genAI = new GoogleGenerativeAI(apiKey);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

    // Build hierarchical lineage to improve embedding context
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    
    const buildLineageText = (nodeId: string): string => {
      const node = nodeMap.get(nodeId);
      if (!node) return "";
      if (!node.parent_id) return `${node.node_type}: ${node.name}`;
      return `${buildLineageText(node.parent_id)} > ${node.node_type}: ${node.name}`;
    };

    // Generate embeddings (batching in production, serial for phase 1 demo)
    for (const node of nodes) {
      const lineageText = buildLineageText(node.id);
      
      const result = await embeddingModel.embedContent(lineageText);
      const embeddingValues = result.embedding.values;

      await supabase.from("curriculum_node_embeddings").upsert([{
        node_id: node.id,
        embedding: embeddingValues
      }], { onConflict: 'node_id' });
    }

    await supabase.from("classification_jobs").update({ 
      status: 'COMPLETED', 
      completed_at: new Date().toISOString() 
    }).eq("id", jobId);

  } catch (error: any) {
    await supabase.from("classification_jobs").update({ 
      status: 'FAILED', 
      error_message: error.message,
      retry_count: (job.retry_count || 0) + 1 
    }).eq("id", jobId);
    throw error;
  }
}
