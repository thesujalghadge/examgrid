require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: solutions, error: solError } = await supabase
    .from('question_solutions')
    .select('question_id, content_markdown, final_answer, generated_model')
    .eq('is_active', true)
    .limit(10);

  if (solError || !solutions || solutions.length === 0) {
    console.log("No solutions found or error:", solError);
    return;
  }

  for (let i = 0; i < solutions.length; i++) {
    const sol = solutions[i];
    const { data: eq } = await supabase
      .from('exam_questions')
      .select('correct_option_id, correct_numerical_answer, question_type, options, question_text')
      .eq('id', sol.question_id)
      .single();

    let expected = "";
    if (eq) {
      if (eq.question_type === 'NUMERICAL') {
        expected = eq.correct_numerical_answer;
      } else {
        const opt = (eq.options || []).find(o => o.id === eq.correct_option_id);
        expected = opt ? `${opt.label}: ${opt.text}` : eq.correct_option_id;
      }
    }

    console.log(`\n================ QUESTION ${i + 1} ================`);
    console.log(`[QUESTION_ID] : ${sol.question_id}`);
    console.log(`[EXPECTED]    : ${expected}`);
    console.log(`\n[GEMINI OUTPUT]:\n${sol.content_markdown}`);
  }
}

run();
