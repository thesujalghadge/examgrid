import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
  const { data, error } = await supabase.rpc("commit_solution_and_job", {
    p_job_id: "f7ca6d89-ca08-4748-8da8-950734b0d670", // from DB query output
    p_institute_id: "ddcc7407-fbb6-42bd-9751-576ef43e2241",
    p_question_id: "cbt-99d743c3-961d-4943-8e24-81c41ee2fadf-paper-1782569405931-question-4",
    p_version: 1,
    p_content_markdown: "Test",
    p_final_answer: "Test",
    p_answer_confidence: 0.9,
    p_provider: "Google",
    p_model_name: "test",
    p_prompt_version: "v1",
    p_token_usage: { estimated: 1200 },
    p_ai_metadata: {},
    p_tokens_used: 1200
  });
  console.log("Error:", error);
  console.log("Data:", data);
}
run();
