require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runLocalWorker() {
  console.log("Starting aggressive local worker...");
  while (true) {
    try {
      const { data, error } = await supabase.rpc("lease_solution_generation_job_v2");
      if (error) {
        console.error("RPC error:", error);
        break;
      }
      if (!data || data.length === 0) {
        console.log("Queue is empty. Exiting.");
        break;
      }
      
      const job = data[0];
      console.log(`Leased job ${job.id}`);
      
      const { data: queueItem } = await supabase.from("solution_generation_queue").select("question_id").eq("id", job.id).single();
      const examQuestionId = queueItem.question_id;
      
      const { data: eq } = await supabase.from("exam_questions").select("published_question_text, published_options, published_answer_key, published_image_url").eq("id", examQuestionId).single();
      
      const apiKey = process.env.GEMINI_API_KEY;
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
      
      const resolvedCorrectAnswer = eq.published_answer_key || "UNKNOWN";
      if (resolvedCorrectAnswer === "UNKNOWN") {
        await supabase.from("solution_generation_queue").update({ status: "FAILED" }).eq("id", job.id);
        continue;
      }

      let promptText = `Question:\n${eq.published_question_text}\n\nThe exact correct answer to this question is: "${resolvedCorrectAnswer}".\n\nYou are an expert JEE faculty. Provide exact three sections: **Approach:**, **Calculation:**, and **Final Answer:**. Target 40-120 words.`;
      
      console.log(`Calling Gemini for ${examQuestionId}...`);
      let result;
      try {
        result = await model.generateContent(promptText);
      } catch(e) {
        console.error("Gemini error:", e.message);
        await supabase.from("solution_generation_queue").update({ status: "WAITING_RETRY" }).eq("id", job.id);
        continue;
      }
      
      const solutionText = result.response.text();
      
      const payload = {
        question_id: examQuestionId,
        institute_id: job.institute_id,
        content_markdown: solutionText,
        is_active: true,
        generation_status: "COMPLETED",
        provider: "Google",
        model_name: "gemini-2.5-flash",
        version: 1,
        generation_attempts: 1,
        validation_passed: true,
        generated_at: new Date().toISOString()
      };
      
      await supabase.from("question_solutions").insert(payload);
      await supabase.from("solution_generation_queue").update({ status: "COMPLETED" }).eq("id", job.id);
      console.log(`Completed job ${job.id}`);
      
      // wait 2 seconds to avoid 429
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(err);
      break;
    }
  }
}
runLocalWorker();
