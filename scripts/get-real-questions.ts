import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

async function getRealQuestions() {
  // Try to find published questions with images first
  let { data: questions, error } = await supabase
    .from("exam_questions")
    .select("id, question_text, published_image_url, published_answer_key, published_options, correct_numerical_answer, correct_option_id, options")
    .not("published_image_url", "is", null)
    .limit(3);

  if (error || !questions || questions.length === 0) {
    // Fallback: join with test_question_assets if no published ones exist
    const { data: assets } = await supabase
      .from("test_question_assets")
      .select("exam_question_id, image_url, storage_path")
      .not("storage_path", "is", null)
      .limit(3);

    if (assets && assets.length > 0) {
      const qIds = assets.map(a => a.exam_question_id);
      const { data: qs } = await supabase
        .from("exam_questions")
        .select("id, question_text, published_answer_key, published_options, correct_numerical_answer, correct_option_id, options")
        .in("id", qIds);
      
      questions = qs?.map(q => {
        const asset = assets.find(a => a.exam_question_id === q.id);
        return { ...q, published_image_url: asset?.storage_path };
      }) || [];
    }
  }

  console.log(JSON.stringify(questions, null, 2));
}

getRealQuestions();
