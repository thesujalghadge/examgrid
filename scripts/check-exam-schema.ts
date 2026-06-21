import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from("exam_questions")
    .select("exam_id")
    .limit(1);
  
  if (error) {
    console.error("Error querying exam_id:", error.message);
  } else {
    console.log("Success! exam_id type:", typeof data[0].exam_id, data[0].exam_id);
  }
}
run().catch(console.error);
