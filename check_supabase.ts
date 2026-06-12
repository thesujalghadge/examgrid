import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: exams, error: err1 } = await supabase
    .from("exams")
    .select("id, title")
    .order("created_at", { ascending: false })
    .limit(3);

  if (err1 || !exams || exams.length === 0) {
    console.error("No exams found", err1);
    return;
  }

  console.log("Latest exams:", exams);

  const examId = exams[0].id;
  const { data: questions, error: err2 } = await supabase
    .from("exam_questions")
    .select("id, sort_order, options, question_number, bank_question_id")
    .eq("exam_id", examId)
    .order("sort_order", { ascending: true });

  if (err2) {
    console.error(err2);
    return;
  }

  console.log(`Questions for latest exam (${examId}):`);
  for (const q of questions || []) {
    console.log(`Q${q.question_number} (sort: ${q.sort_order}):`);
    console.log(JSON.stringify(q.options, null, 2));
    console.log("Bank ID:", q.bank_question_id);
    console.log("---");
  }
}

main().catch(console.error);
