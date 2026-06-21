import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { error } = await supabase
    .from("test_question_assets")
    .select("id, exam_question_id")
    .eq("exam_id", "d18c20cf-7c4b-455c-b2b5-098e0919ebac");
  
  if (error) {
    console.error("Error querying test_question_assets by exam_id:", error.message);
  } else {
    console.log("Success! test_question_assets has exam_id column.");
  }
}
run().catch(console.error);
