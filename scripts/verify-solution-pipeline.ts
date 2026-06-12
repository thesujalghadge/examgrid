require("dotenv").config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { enqueueQuestionsForGeneration, leaseJob } from "../src/lib/solutions/queue";
import { processLeasedJob } from "../src/lib/solutions/solution-generator";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "dummy-key-for-tests";
const supabase = createClient(supabaseUrl, supabaseKey);

import { GeminiProvider } from "../src/lib/ai/providers/gemini-provider";

GeminiProvider.prototype.generateSolution = async function() {
  return {
    markdownSolution: "## Step 1\nWe use the formula d = v * t.\n\n## Step 2\nd = 20 * 10 = 200m.",
    finalAnswer: "200 m",
    answerConfidence: 0.99,
    promptVersion: "solution-v1",
    aiMetadata: {
      taxonomy: { subject: "Physics", topic: "Kinematics", subtopic: "Linear Motion" },
      cognitiveLevel: "Application",
      difficulty: 0.2
    },
    tokenUsage: { prompt: 100, completion: 50, total: 150 }
  };
};

async function runTests() {
  console.log("Starting Phase 2.5 End-to-End Pipeline Verification...\n");

  // Setup: Create dummy institute
  const { data: institute, error: instErr } = await supabase
    .from("institutes")
    .insert({ 
      name: "E2E Test Institute", 
      slug: "e2e-test-institute-" + Date.now(),
      gemini_api_key_encrypted: "Yf9PHtcXCdOoPU6C8pjLiuNMChVy5Q13poI5LNEk//PrqpeoZRDiZKK0cGn1ZbpoKKuAckwzwO5B30FAUlxSATTGvutk",
      gemini_api_key_iv: "xYGWQFqAm8Ne5eoU",
      gemini_api_key_set_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (instErr) throw new Error(`Setup failed: ${instErr.message}`);
  const instituteId = institute.id;

  // Setup: Create dummy question
  const { data: question, error: qErr } = await supabase
    .from("questions")
    .insert({
      institute_id: instituteId,
      subject: "Physics",
      difficulty: "medium",
      question_type: "MCQ_SINGLE",
      question_text: "A car travels at 20 m/s for 10 seconds. How far does it travel?",
      correct_answer: "200 m"
    })
    .select("id")
    .single();

  if (qErr) throw new Error(`Setup failed: ${qErr.message}`);
  const questionId = question.id;

  // Setup: Create question_content
  await supabase.from("question_content").insert({
    question_id: questionId,
    institute_id: instituteId,
    raw_text: "A car travels at 20 m/s for 10 seconds. How far does it travel?",
    correct_answer: "200 m",
    extracted_subject: "Physics",
    extracted_chapter: "Kinematics"
  });

  try {
    console.log(`Test 1 (Setup): Question ${questionId} created successfully.`);

    // Test 2: Enqueue
    console.log("Running Test 2: Enqueue Logic...");
    const enqueueResult = await enqueueQuestionsForGeneration([questionId], instituteId, 100);
    if (enqueueResult.enqueued !== 1) throw new Error("Failed to enqueue question.");
    
    const { data: queueRow } = await supabase.from("solution_generation_queue").select("*").eq("question_id", questionId).single();
    if (!queueRow || queueRow.status !== "pending") throw new Error("Queue row is missing or not pending.");
    console.log("Test 2 Passed: Job successfully queued as pending with priority 100.\n");

    // Test 3: Lease Job
    console.log("Running Test 3: Lease Job...");
    const leased = await leaseJob();
    if (!leased || leased.question_id !== questionId) throw new Error("Failed to lease job.");
    console.log("Test 3 Passed: Job leased successfully via FOR UPDATE SKIP LOCKED.\n");

    // Test 4: Verify Gemini Output
    console.log("Running Test 4: Generation via Provider...");
    await processLeasedJob(leased);
    
    const { data: solution } = await supabase.from("question_solutions").select("*").eq("question_id", questionId).single();
    if (!solution || !solution.content_markdown || !solution.ai_metadata) {
      throw new Error("Generation failed: Solution content or AI metadata is missing.");
    }
    console.log("Test 4 Passed: Solution generated successfully!");
    console.log(`- Final Answer: ${solution.final_answer}`);
    console.log(`- Confidence: ${solution.answer_confidence}`);
    console.log(`- Metadata Topic: ${solution.ai_metadata?.taxonomy?.topic}\n`);

    // Test 5: Verify Idempotency
    console.log("Running Test 5: Idempotency (Duplicate Publish)...");
    const dupEnqueue = await enqueueQuestionsForGeneration([questionId], instituteId, 100);
    if (dupEnqueue.enqueued !== 0) throw new Error("Duplicate enqueue was not blocked.");
    console.log("Test 5 Passed: Queue gracefully blocked duplicate enqueue.\n");

    // Test 7: Active Solution Protection
    console.log("Running Test 7: Active Solution Protection...");
    // Let's force an enqueue by wiping the queue row but leaving the active solution
    await supabase.from("solution_generation_queue").delete().eq("question_id", questionId);
    
    const activeTestEnqueue = await enqueueQuestionsForGeneration([questionId], instituteId, 100);
    if (activeTestEnqueue.enqueued !== 0) throw new Error("Question with active solution was enqueued.");
    console.log("Test 7 Passed: Active solutions perfectly block new generation attempts.\n");

    console.log("ALL E2E VALIDATION TESTS PASSED.");

  } finally {
    // Cleanup
    await supabase.from("institutes").delete().eq("id", instituteId);
  }
}

runTests().catch(err => {
  console.error("\nE2E TEST FAILED:", err);
  process.exit(1);
});
