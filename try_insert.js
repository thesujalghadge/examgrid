require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const instituteId = 'ddcc7407-fbb6-42bd-9751-576ef43e2241';
  const examId = '039f0498-811d-4669-9d9e-b578d6ff0bc6';

  const { data: questions } = await supabase.from("exam_questions").select("id").eq("exam_id", examId);
  console.log(`Questions found: ${questions.length}`);
  
  const newItems = questions.map(q => ({
    institute_id: instituteId,
    question_id: q.id,
    test_question_asset_id: null,
    status: "PENDING",
    priority: 100
  }));

  const { error: insertError } = await supabase.from("solution_generation_queue").insert(newItems);
  if (insertError) {
    console.error("Insert error:", insertError);
  } else {
    console.log("Insert successful!");
  }
}
run();
