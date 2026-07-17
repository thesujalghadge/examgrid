import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const instituteId = 'bd3fb232-98ea-480e-a80e-6cc991e38fb1'; // Demo Institute
  const scheduleId = 'd8225585-7033-4df5-a7b2-65825bc5e59b';

  // Get Exam ID dynamically
  const { data: exams, error: exErr } = await supabase.from('exams').select('id').eq('title', 'JEE Main 2025 (22 Jan Shift 1)').limit(1);
  if (exErr || !exams || exams.length === 0) {
    console.error('Could not find exam:', exErr);
    return;
  }
  const examId = exams[0].id;
  console.log('Found exam ID:', examId);

  console.log('Inserting Exam Schedule...');
  const { error: sErr } = await supabase.from('exam_schedules').upsert({
    id: scheduleId,
    exam_id: examId,
    institute_id: instituteId,
    start_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    end_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    duration_minutes: 180,
    is_active: true
  });
  if (sErr && !sErr.message.includes('duplicate')) {
    console.error('Schedule Error:', sErr);
  } else {
    console.log('Schedule Inserted.');
  }

  // Get all batches for the institute
  const { data: batches } = await supabase.from('batches').select('id').eq('institute_id', instituteId);
  
  if (batches && batches.length > 0) {
    const batchInserts = batches.map(b => ({
      schedule_id: scheduleId,
      batch_id: b.id,
      institute_id: instituteId
    }));
    const { error: bErr } = await supabase.from('exam_schedule_batches').upsert(batchInserts);
    if (bErr && !bErr.message.includes('duplicate')) {
      console.error('Batch Schedule Error:', bErr);
    } else {
      console.log('Assigned to batches:', batches.length);
    }
  }
}
main();
