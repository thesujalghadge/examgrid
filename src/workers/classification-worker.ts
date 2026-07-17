import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { classifyQuestionAgainstCurriculum } from "@/services/curriculum-classification-service";
import { processCurriculumEmbeddingJob } from "@/services/curriculum-embedding-service";

export async function processNextClassificationJob() {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Service role not configured");

  // 1. Fetch next queued job
  const { data: job, error: jobError } = await supabase
    .from("classification_jobs")
    .select("*")
    .eq("status", "QUEUED")
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (jobError || !job) {
    if (jobError?.code === 'PGRST116') return null; // No jobs
    throw new Error("Failed to fetch job: " + jobError?.message);
  }

  // 2. Mark processing
  const { error: lockError } = await supabase
    .from("classification_jobs")
    .update({ status: 'PROCESSING', started_at: new Date().toISOString() })
    .eq("id", job.id)
    .eq("status", "QUEUED"); // Optimistic locking

  if (lockError) return null; // Someone else grabbed it

  try {
    if (job.job_type === 'EMBED_CURRICULUM') {
      await processCurriculumEmbeddingJob(job.id);
    } else if (job.job_type === 'CLASSIFY_QUESTION') {
      const questionId = job.payload.questionId;
      const curriculumVersionId = job.payload.curriculumVersionId;
      
      if (!questionId) throw new Error("Missing questionId in payload");
      if (!curriculumVersionId) throw new Error("Missing curriculumVersionId in payload");
      
      await classifyQuestionAgainstCurriculum(questionId, { 
        curriculumVersionId, 
        jobId: job.id 
      });

      // 3. Mark completed
      await supabase
        .from("classification_jobs")
        .update({ 
          status: 'COMPLETED', 
          completed_at: new Date().toISOString(),
          error_message: null
        })
        .eq("id", job.id);
    } else {
      throw new Error(`Unknown job type: ${job.job_type}`);
    }
  } catch (error: any) {
    console.error(`Error processing job ${job.id}:`, error);
    
    // 4. Mark failed and increment retry
    await supabase
      .from("classification_jobs")
      .update({ 
        status: 'FAILED', 
        error_message: error.message,
        retry_count: (job.retry_count || 0) + 1 
      })
      .eq("id", job.id);
  }

  return job;
}
