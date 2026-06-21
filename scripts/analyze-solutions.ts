import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: queueJobs } = await supabase.from('solution_generation_queue').select('question_id, failure_reason').order('created_at', { ascending: false }).limit(15);
  const qIds = queueJobs?.map((q: any) => q.question_id) || [];
  
  const { data: questions } = await supabase.from('exam_questions').select('id, question_number, question_type').in('id', qIds);
  
  if (!questions || !queueJobs) {
    console.log("No data found");
    return;
  }

  const qMap = new Map();
  questions.forEach((q: any) => qMap.set(q.id, q));

  const stats: any = {
    Math: [],
    Physics: [],
    Chemistry: [],
    MCQ: [],
    NAT: []
  };

  queueJobs.forEach((job: any) => {
    const q = qMap.get(job.question_id);
    if (!q || !job.failure_reason) return;

    const match = job.failure_reason.match(/\\((\\d+) words\\)/);
    if (!match) return;
    const wordCount = parseInt(match[1], 10);

    const qNum = parseInt(q.question_number, 10);
    let subject = "Math";
    if (qNum > 5 && qNum <= 10) subject = "Physics";
    if (qNum > 10) subject = "Chemistry";

    const type = q.question_type === "NUMERICAL" ? "NAT" : "MCQ";
    
    stats[subject].push(wordCount);
    stats[type].push(wordCount);
  });

  console.log("Raw Word Counts:");
  console.log("Math:", stats.Math.sort((a: number, b: number) => a - b));
  console.log("Physics:", stats.Physics.sort((a: number, b: number) => a - b));
  console.log("Chemistry:", stats.Chemistry.sort((a: number, b: number) => a - b));
  console.log("MCQ:", stats.MCQ.sort((a: number, b: number) => a - b));
  console.log("NAT:", stats.NAT.sort((a: number, b: number) => a - b));
}
run();
