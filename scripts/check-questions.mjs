import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkQuestions() {
  const { data: questions } = await supabase.from("exam_questions").select("id, exam_id").limit(10);
  console.log("Questions in DB:", questions?.length || 0);
  console.log("Sample:", questions);
}

checkQuestions().catch(console.error);
