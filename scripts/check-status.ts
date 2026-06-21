import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data: e } = await supabase.from('exams').select('id').eq('title', 'JEE PYQ-3').order('created_at', { ascending: false }).limit(1);
  if (!e || e.length === 0) return;
  const eId = e[0].id;
  
  const { data: q } = await supabase.from('exam_questions').select('*').eq('exam_id', eId);
  const qIds = q!.map(x => x.id);
  
  const { data: qs } = await supabase.from('question_solutions').select('*').in('question_id', qIds);
  console.log(`Solutions: ${qs!.length}/${qIds.length}`);
  
  const { data: queue } = await supabase.from('solution_generation_queue').select('*').in('question_id', qIds);
  const stats = queue!.reduce((acc: any, x) => ({...acc, [x.status]: (acc[x.status]||0)+1}), {});
  console.log("Queue Status:", stats);

  console.log("\nQueue items not COMPLETED:");
  for (const item of queue!) {
    if (item.status !== "COMPLETED") {
       console.log(item.id, item.question_id, item.status);
    }
  }

}

run();
