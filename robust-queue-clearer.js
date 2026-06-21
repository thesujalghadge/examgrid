// Wait, require won't work with TS without tsx.

// I will use fetch to call the API instead!
async function clearQueue() {
  console.log("Starting queue clearer...");
  let emptyCount = 0;
  while (true) {
    try {
      const res = await fetch('http://localhost:3000/api/internal/process-solution-queue', {
        method: 'POST',
        headers: { 'authorization': `Bearer dev-secret` }
      });
      const data = await res.json();
      console.log('Processed:', data.jobsProcessed);
      
      let rateLimited = false;
      if (data.results) {
        for (const r of data.results) {
          if (r.reason && r.reason.includes('Quota')) rateLimited = true;
        }
      }

      if (data.jobsProcessed === 0 && !rateLimited) {
        emptyCount++;
        if (emptyCount > 2) {
          console.log("Queue seems fully empty. Done.");
          break;
        }
      } else {
        emptyCount = 0;
      }
      
      if (rateLimited) {
        console.log("Rate limited! Waiting 60 seconds...");
        await new Promise(r => setTimeout(r, 60000));
        
        // Reset waiting items
        const { createClient } = require('@supabase/supabase-js');
        require('dotenv').config({path:'.env.local'});
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        await supabase.from('solution_generation_queue').update({status:'PENDING', next_retry_at: null}).eq('status', 'WAITING_RETRY');
      } else {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {
      console.error(e);
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}
clearQueue();
