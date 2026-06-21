import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // use service role key to bypass RLS

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanRoomReset() {
  console.log("Starting Clean Room Reset...");

  // Order matters for foreign key constraints if not using cascade
  // Since we are using Supabase JS client and want to delete all,
  // we delete from bottom-up of dependency tree.
  const tables = [
    "solution_generation_events",
    "solution_generation_queue",
    "question_solutions",
    "student_responses",
    "exam_attempts",
    "test_sessions",
    "exam_questions",
    "exam_sections",
    "exams",
    "questions",
    "students",
    "batches",
    "institutes"
  ];

  for (const table of tables) {
    console.log(`Deleting all records from ${table}...`);
    // Delete all records where id is not null (which is all records)
    const { error } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Just a dummy condition to delete all

    if (error) {
      console.error(`Error deleting from ${table}:`, error.message);
    } else {
      console.log(`Cleared ${table}.`);
    }
  }

  console.log("Clean Room Reset Complete.");
}

cleanRoomReset().catch(console.error);
