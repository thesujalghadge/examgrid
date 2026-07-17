import { createServiceRoleClient } from "@/lib/institute/get-institute-api-key";
import { enqueueQuestionsForGeneration, leaseJob } from "@/lib/solutions/queue";
import { processLeasedJob } from "@/lib/solutions/solution-generator";

async function main() {
  const supabase = createServiceRoleClient();
  if (!supabase) throw new Error("Supabase client unavailable");

  // Get a few questions from exam_questions to generate solutions for
  const { data: questions, error } = await supabase
    .from("exam_questions")
    .select("id, institute_id")
    .limit(3);

  if (error || !questions) {
    console.error("Failed to fetch questions", error);
    process.exit(1);
  }

  console.log("Enqueuing questions:", questions.map(q => q.id));

  // Enqueue
  for (const q of questions) {
    // Delete existing so we can re-generate
    await supabase.from("question_solutions").delete().in("question_id", [q.id]);
    await supabase.from("solution_generation_queue").delete().in("question_id", [q.id]);

    await enqueueQuestionsForGeneration([q.id], q.institute_id);
  }

  console.log("Processing leased jobs...");
  
  // Process 3 jobs
  for (let i = 0; i < 3; i++) {
    const job = await leaseJob();
    if (job) {
      console.log(`Processing job ${job.id} for question ${job.question_id}`);
      await processLeasedJob(job);
    } else {
      console.log("No jobs available to lease.");
    }
  }

  console.log("Fetching resulting solutions...");
  const { data: solutions } = await supabase
    .from("question_solutions")
    .select("question_id, provider, prompt_version, token_usage, ai_metadata")
    .in("question_id", questions.map(q => q.id))
    .eq("prompt_version", "solution-v3");

  if (solutions) {
    for (const sol of solutions) {
      console.log("\n========================================================");
      console.log(`Question ID: ${sol.question_id}`);
      console.log(`Tokens:`, sol.token_usage);
      console.log(`AI Metadata:`);
      console.log(JSON.stringify(sol.ai_metadata, null, 2));
      console.log("========================================================\n");
    }
  }
}

main().catch(console.error);
