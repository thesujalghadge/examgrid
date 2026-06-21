import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from("solution_generation_queue")
    .select("test_question_asset_id")
    .limit(1);
  
  if (error) {
    console.error("Error querying test_question_asset_id:", error.message);
  } else {
    console.log("Success! test_question_asset_id column exists.");
  }
}
run().catch(console.error);
