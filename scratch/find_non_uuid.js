const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const isUuid = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

async function check() {
  const tables = [
    'exams', 'exam_schedules', 'cbt_attempts', 'cbt_results', 'analytics_jobs',
    'analytics_snapshots', 'question_analytics', 'student_recommendations',
    'student_exam_subject_analytics', 'student_exam_chapter_analytics',
    'student_exam_concept_analytics', 'exam_solution_status', 'question_solutions',
    'test_question_assets'
  ];
  
  for (const table of tables) {
    try {
      const { data: allData, error: allErr } = await sb.from(table).select('*');
      if (allErr) continue;
      
      for (const row of allData || []) {
        for (const [key, val] of Object.entries(row)) {
          if (val && typeof val === 'string' && (key.includes('exam_id') || key.includes('test_id') || key.includes('question_id') || key === 'id')) {
            if (!isUuid(val)) {
               console.log(`table_name: ${table} | column_name: ${key} | value: ${val} | pk: ${row.id || 'no_id'}`);
            }
          }
        }
      }
    } catch (e) {}
  }
}
check();
