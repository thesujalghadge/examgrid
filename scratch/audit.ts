import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchOne(table: string) {
  const { data, error } = await supabase.from(table).select("*").limit(1).maybeSingle();
  if (error) {
    console.error(`Error fetching ${table}:`, error.message);
    return null;
  }
  return data;
}

async function main() {
  const tables = [
    "cbt_attempts",
    "cbt_attempt_answers",
    "cbt_results",
    "exam_questions",
    "question_solutions"
  ];

  for (const table of tables) {
    console.log(`\n--- ${table} ---`);
    const data = await fetchOne(table);
    if (!data) {
       console.log("No data found or table doesn't exist.");
    } else {
       console.log(JSON.stringify(data, null, 2));
    }
  }
}

main().catch(console.error);
