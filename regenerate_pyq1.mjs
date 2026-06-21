import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
// dynamic import of worker so dotenv runs first

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function run() {
    const examId = 'be5f852f-fc50-4559-9660-22a461bc80d6'; // PYQ-1

    // 1. Delete existing solutions
    // await supabase.from('question_solutions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // delete all

    // 2. Clear queue
    // await supabase.from('solution_generation_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    // const { data: exam } = await supabase.from('exams').select('institute_id').eq('id', examId).single();
    
    // const { enqueueSolutionsForExam } = await import('./src/lib/background-jobs/queue-trigger.ts');
    // await enqueueSolutionsForExam(examId, exam.institute_id);

    // 4. Run worker loop
    const { runGeminiWorker } = await import('./src/lib/background-jobs/gemini-worker.ts');
    let processed = 0;
    while(true) {
        const res = await runGeminiWorker();
        console.log(res);
        if (res.processed > 0) processed++;
        if (res.reason === "Queue empty" || res.processed === 0) break;
    }
    
    console.log(`Worker processed ${processed} items.`);
}

run().catch(console.error);
