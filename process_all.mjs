import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
  // First, set all WAITING_RETRY or FAILED to PENDING
  await supabase.from('solution_generation_queue').update({ status: 'PENDING', attempts: 0, next_retry_at: null }).in('status', ['WAITING_RETRY', 'FAILED']);

  while (true) {
    const { data } = await supabase.from('solution_generation_queue').select('status');
    const counts = { PENDING: 0, PROCESSING: 0, COMPLETED: 0, FAILED: 0, WAITING_RETRY: 0 };
    for (const d of data) counts[d.status]++;
    
    console.log(`Queue Status:`, counts);

    if (counts.PENDING === 0 && counts.WAITING_RETRY === 0 && counts.PROCESSING === 0) {
      console.log('All done!');
      break;
    }

    if (counts.PENDING > 0 && counts.PROCESSING === 0) {
      console.log('Triggering batch of 5...');
      try {
        await fetch('http://localhost:3000/api/internal/process-solution-queue', { method: 'POST', headers: { 'Authorization': 'Bearer ' + process.env.CRON_SECRET } });
      } catch(e) {
        console.error('Fetch error:', e.message);
      }
      
      // Wait 25 seconds before next trigger to stay safely under 15 RPM
      // 5 requests every 25 seconds = 12 RPM
      console.log('Waiting 25 seconds to respect rate limits...');
      await new Promise(r => setTimeout(r, 25000));
    } else if (counts.WAITING_RETRY > 0 && counts.PROCESSING === 0) {
      console.log('Resetting WAITING_RETRY to PENDING...');
      await supabase.from('solution_generation_queue').update({ status: 'PENDING', attempts: 0, next_retry_at: null }).eq('status', 'WAITING_RETRY');
      await new Promise(r => setTimeout(r, 5000));
    } else {
      console.log('Waiting for PROCESSING to finish...');
      await new Promise(r => setTimeout(r, 10000));
    }
  }
}

run().catch(console.error);
