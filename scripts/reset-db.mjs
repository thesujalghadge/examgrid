import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
  const tables = [
    "cbt_attempt_answers",
    "cbt_final_attempts",
    "solution_generation_events",
    "solution_generation_queue",
    "question_solutions",
    "exam_questions",
    "exam_sections",
    "schedules",
    "exams",
    "cbt_tests",
    "background_jobs",
    "test_question_assets",
    "institute_students",
    "institute_batches",
    "institute_ai_settings",
    "institutes",
  ];

  console.log("Clearing data from tables...");

  for (const table of tables) {
    console.log(`Clearing ${table}...`);
    const { error } = await supabase.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete everything
    if (error) {
      console.error(`Failed to clear ${table}:`, error);
    } else {
      console.log(`Cleared ${table}`);
    }
  }

  console.log("Database cleared successfully!");
}

clearData().catch(console.error);
