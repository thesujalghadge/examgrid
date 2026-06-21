import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: exams, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: false });
  
  if (!exams || exams.length === 0) {
    console.log("No published exams found.");
    return;
  }
  
  const exam = exams[0];
  console.log(`Using exam: ${exam.title} (${exam.id})`);

  const { data: questions } = await supabase
    .from('exam_questions')
    .select('*')
    .eq('exam_id', exam.id)
    .order('order_index', { ascending: true });

  console.log(`Found ${questions?.length} questions.`);
  
  const qIds = questions?.map(q => q.id) || [];
  
  const { data: queueItems } = await supabase
    .from('solution_generation_queue')
    .select('*')
    .in('question_id', qIds);

  const { data: solutions } = await supabase
    .from('question_solutions')
    .select('*')
    .in('question_id', qIds);

  console.log("\n| Question | Image Path | In Queue | Solution Stored | Metadata Stored |");
  console.log("|---|---|---|---|---|");
  
  questions?.forEach(q => {
    const queue = queueItems?.find(qi => qi.question_id === q.id);
    const sol = solutions?.find(s => s.question_id === q.id);
    const hasImage = q.image_url ? "YES" : "NO";
    const inQueue = queue ? "YES" : "NO";
    const solStored = sol ? "YES" : "NO";
    const metaStored = sol && sol.metadata ? "YES" : "NO";
    
    console.log(`| ${q.id.split('-')[0]}... | ${hasImage} | ${inQueue} | ${solStored} | ${metaStored} |`);
  });

  if (solutions && solutions.length > 0) {
    console.log("\nSample solution (raw db row):");
    const sol = solutions[0];
    console.log(`subject: ${sol.metadata?.subject}`);
    console.log(`chapter: ${sol.metadata?.chapter}`);
    console.log(`concepts: ${JSON.stringify(sol.metadata?.concepts)}`);
    console.log(`confidence: ${sol.metadata?.confidence_score}`);
    console.log(`solution markdown:`);
    console.log(sol.solution_markdown?.substring(0, 200) + '...');
  }
}

run().catch(console.error);
