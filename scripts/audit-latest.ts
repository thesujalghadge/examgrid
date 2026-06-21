import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function run() {
  const { data: exams } = await s
    .from("exams")
    .select("id, title, created_at, legacy_id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!exams || exams.length === 0) {
    console.log("No exams found.");
    return;
  }

  const exam = exams[0];
  console.log("Latest Exam: " + exam.title + " (" + exam.id + ")");

  const { count: qCount } = await s
    .from("exam_questions")
    .select("*", { count: "exact", head: true })
    .eq("exam_id", exam.id);
  console.log("exam_questions count: " + (qCount || 0));

  const { data: qData } = await s
    .from("exam_questions")
    .select("id")
    .eq("exam_id", exam.id);
  const qIds = qData?.map((q: any) => q.id) || [];

  let queueCount = 0;
  if (qIds.length > 0) {
    const { count } = await s
      .from("solution_generation_queue")
      .select("*", { count: "exact", head: true })
      .in("question_id", qIds);
    queueCount = count || 0;
  }
  console.log("solution_generation_queue count: " + queueCount);
}

run();
