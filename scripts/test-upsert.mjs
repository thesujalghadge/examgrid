import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testInsert() {
  const payload = {
    test_question_asset_id: null,
    question_id: 'cbt-dd237011-6ff5-4461-9c0e-626c5862a2ce-paper-1781459997845-question-1',
    institute_id: 'babb0669-a6ec-454f-923a-440f0144f68f',
    content_markdown: 'test',
    is_active: true,
    generation_status: 'COMPLETED',
    provider: "Google",
    model_name: 'test',
    generation_source: 'INSTITUTE_KEY',
    generated_model: 'test',
    version: 1,
    prompt_version: 'test',
    prompt_snapshot: 'test',
    generation_duration_ms: 100,
    generation_attempts: 1,
    validation_passed: true,
    generated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("question_solutions")
    .upsert(payload, { onConflict: "test_question_asset_id" });

  console.log("Error:", error);
}

testInsert().catch(console.error);
