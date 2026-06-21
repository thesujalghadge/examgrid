require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: exams } = await supabase.from('exams').select('id, title, is_published');
  console.log(`Found ${exams.length} exams.`);

  const {count: qCount} = await supabase.from('exam_questions').select('*', {count: 'exact', head: true});
  const {count: sCount} = await supabase.from('question_solutions').select('*', {count: 'exact', head: true}).eq('is_active', true);
  
  console.log(`\n=== GLOBAL PARITY ===`);
  console.log(`Published Questions (Phase 1): ${qCount}`);
  console.log(`Active Solutions Generated: ${sCount}`);
  console.log(`Parity Gap: ${qCount - sCount}\n`);

  for (const e of exams) {
    if (!e.is_published) continue;
    const {count: eq} = await supabase.from('exam_questions').select('*', {count: 'exact', head: true}).eq('exam_id', e.id);
    console.log(`Exam: ${e.title} | Published Qs: ${eq}`);
  }
}
run();
