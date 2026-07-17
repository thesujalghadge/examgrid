const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const tables = [
    'exams', 'exam_schedules', 'cbt_attempts', 'cbt_results', 'analytics_jobs',
    'analytics_snapshots', 'question_analytics', 'student_recommendations',
    'student_exam_subject_analytics', 'student_exam_chapter_analytics',
    'student_exam_concept_analytics', 'exam_solution_status'
  ];
  
  for (const table of tables) {
    try {
      const { data: allData, error: allErr } = await sb.from(table).select('*');
      if (allErr) {
          console.log('Error reading all', table, allErr.message);
          continue;
      }
      
      for (const row of allData || []) {
        for (const [key, val] of Object.entries(row)) {
          if (String(val) === '12345') {
            console.log(`table_name: ${table} | column_name: ${key} | value: ${val} | pk: ${row.id}`);
          }
        }
      }
    } catch (e) {
      console.log('Error in', table, e);
    }
  }
}
check();
