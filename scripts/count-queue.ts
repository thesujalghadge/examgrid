import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const examId = "d18c20cf-7c4b-455c-b2b5-098e0919ebac";
  const { data: questions } = await supabase.from("exam_questions").select("id").eq("exam_id", examId);
  const qIds = questions?.map(q => q.id) || [];
  
  if (qIds.length > 0) {
    const { count } = await supabase.from("solution_generation_queue").select("*", { count: "exact" }).in("question_id", qIds);
    console.log(`Queue count: ${count}`);

    const { data: q } = await supabase.from("solution_generation_queue").select("*").in("question_id", qIds);
    console.log("Queue rows:", q);
  }
}
run().catch(console.error);
