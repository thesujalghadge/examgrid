require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  const instituteId = 'ddcc7407-fbb6-42bd-9751-576ef43e2241';
  const testId = 'E2E-TEST-1781797167811'; 

  const query = supabase
    .from("exams")
    .select("id, solutions_release_time")
    .eq("institute_id", instituteId)
    .eq("legacy_id", testId);
  
  const { data: exam } = await query.single();
  console.log("Exam:", exam);

  const { data: questions } = await supabase.from("exam_questions").select("id").eq("exam_id", exam.id);
  console.log(`Total questions: ${questions.length}`);
  
  // Pick the first question ID
  const questionId = questions[0].id;
  console.log(`Testing with questionId: ${questionId}`);

  const { data: solution } = await supabase
    .from("question_solutions")
    .select("content_markdown, final_answer, ai_metadata")
    .eq("institute_id", instituteId)
    .eq("question_id", questionId)
    .eq("is_active", true)
    .maybeSingle();

  console.log("Solution found:", !!solution);
  
  const { data: qItem } = await supabase
    .from('solution_generation_queue')
    .select('status')
    .eq('question_id', questionId)
    .maybeSingle();
    
  console.log("Queue item found:", qItem);
}
run();
