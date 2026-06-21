import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from("exam_questions")
    .select("*")
    .neq("published_image_url", null)
    .limit(1)
    .single();

  if (error) {
    console.error("Error fetching question:", error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
