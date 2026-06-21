const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function clean() {
  console.log("Deleting all solutions...");
  await s.from('question_solutions').delete().neq("id", "00000000-0000-0000-0000-000000000000");
  console.log("Deleting all queue jobs...");
  await s.from('solution_generation_queue').delete().neq("id", "00000000-0000-0000-0000-000000000000");
  
  console.log("Fetching exam_questions...");
  const { data: questions } = await s.from('exam_questions').select('*').eq('exam_id', '72a98ee6-1fda-45ab-bd5f-8a9d81ec6dee');
  console.log("Re-queuing", questions.length, "questions...");
  
  for (const q of questions) {
    await s.from('solution_generation_queue').insert({
      question_id: q.id,
      institute_id: q.institute_id || "babb0669-a6ec-454f-923a-440f0144f68f",
      status: "PENDING",
      priority: 100,
      attempts: 0
    });
  }
  console.log("Done.");
}
clean();
