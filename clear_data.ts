import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearData() {
  console.log("Clearing data...");
  
  // Delete exam attempts
  const { error: errAttempts } = await supabase.from("exam_attempts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errAttempts) console.error("Error deleting attempts:", errAttempts);
  else console.log("Cleared exam attempts.");

  // Delete exams (this should cascade to exam_sections and exam_questions if FKs are set up, but let's be explicit just in case)
  const { error: errEq } = await supabase.from("exam_questions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errEq) console.error("Error deleting exam_questions:", errEq);
  else console.log("Cleared exam questions.");

  const { error: errEs } = await supabase.from("exam_sections").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errEs) console.error("Error deleting exam_sections:", errEs);
  else console.log("Cleared exam sections.");

  const { error: errExams } = await supabase.from("exams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errExams) console.error("Error deleting exams:", errExams);
  else console.log("Cleared exams.");

  // Delete question bank
  const { error: errQuestions } = await supabase.from("questions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (errQuestions) console.error("Error deleting question bank:", errQuestions);
  else console.log("Cleared question bank.");

  console.log("All old data cleared successfully.");
}

clearData().catch(console.error);
