import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const examId = "d18c20cf-7c4b-455c-b2b5-098e0919ebac";
  const { data: exam } = await supabase.from("exams").select("institute_id").eq("id", examId).single();
  if (!exam) {
    console.error(`Exam not found for ID: ${examId}`);
    return;
  }
  const instituteId = exam.institute_id;
  console.log(`Exam ID: ${examId}`);
  console.log(`Institute ID: ${instituteId}`);

  // Simulate enqueueSolutionsForExam
  console.log(`[enqueueSolutionsForExam] Called for examId: ${examId}, instituteId: ${instituteId}`);

  // 1. Fetch all questions for this exam
  const { data: questions, error: questionsError } = await supabase
    .from("exam_questions")
    .select("id")
    .eq("exam_id", examId);

  if (questionsError || !questions) {
    console.error("Failed to fetch exam questions:", questionsError);
    return;
  }

  console.log(`Number of questions discovered: ${questions.length}`);

  if (questions.length === 0) {
    console.log("No questions. Bypassing enqueue.");
    return;
  }

  // 2. Fetch assets
  const { data: assets } = await supabase
    .from("test_question_assets")
    .select("id, exam_question_id")
    .eq("exam_id", examId);

  const assetMap = new Map();
  if (assets) {
    assets.forEach(a => assetMap.set(a.exam_question_id, a.id));
  }

  // 3. Find existing queue items
  const questionIds = questions.map(q => q.id);
  console.log(`Question IDs returned from exam_questions: ${questionIds.join(', ')}`);

  const { data: existingQueue } = await supabase
    .from("solution_generation_queue")
    .select("question_id")
    .in("question_id", questionIds);
    
  const existingSet = new Set((existingQueue || []).map(q => q.question_id));

  // 4. Prepare new queue items
  const newItems = questions
    .filter(q => !existingSet.has(q.id))
    .map(q => ({
      institute_id: instituteId,
      question_id: q.id,
      test_question_asset_id: assetMap.get(q.id) || null,
      status: "PENDING",
      priority: 100
    }));

  console.log(`Rows attempted to insert: ${newItems.length}`);
  
  if (newItems.length === 0) {
    console.log("No new items to insert.");
    return;
  }

  // 5. Insert
  const { data: inserted, error: insertError } = await supabase
    .from("solution_generation_queue")
    .insert(newItems)
    .select();

  if (insertError) {
    console.error("Queue insert error (constraint violations?):", JSON.stringify(insertError, null, 2));
  } else {
    console.log(`Rows successfully inserted: ${inserted?.length || 0}`);
  }
}

run().catch(console.error);
