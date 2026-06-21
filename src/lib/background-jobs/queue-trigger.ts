import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function enqueueSolutionsForExam(examId: string, instituteId: string) {
  // 1. Fetch all questions for this exam (the authoritative published snapshot)
  const { data: questions, error: questionsError } = await supabase
    .from("exam_questions")
    .select("id")
    .eq("exam_id", examId);

  if (questionsError || !questions) {
    throw new Error(`Failed to fetch exam questions for exam ${examId}`);
  }

  if (questions.length === 0) {
    return { enqueued: 0, skipped: 0 };
  }

  // 2. Fetch assets to map (if they exist)
  const { data: assets } = await supabase
    .from("test_question_assets")
    .select("id, exam_question_id")
    .eq("exam_id", examId);

  const assetMap = new Map();
  if (assets) {
    assets.forEach(a => assetMap.set(a.exam_question_id, a.id));
  }

  // 3. Find existing queue items to avoid duplicate constraints on question_id
  const questionIds = questions.map(q => q.id);
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

  if (newItems.length === 0) {
    return { enqueued: 0, skipped: questions.length };
  }

  // 5. Insert
  const { error: insertError } = await supabase
    .from("solution_generation_queue")
    .insert(newItems);

  if (insertError) {
    console.error("Queue insert error:", insertError);
    throw new Error(`Failed to enqueue solutions: ${insertError.message}`);
  }

  // Trigger background processing via the API route
  if (process.env.NODE_ENV !== "production") {
    setTimeout(() => {
      // In dev, the API route will daisy-chain itself
      fetch('http://localhost:3000/api/internal/process-solution-queue', {
        method: 'POST',
        headers: { 'authorization': `Bearer ${process.env.CRON_SECRET || 'dev-secret'}` }
      }).catch(err => console.error('Failed to trigger background processing:', err));
    }, 1000);
  }

  return {
    enqueued: newItems.length,
    skipped: existingSet.size
  };
}
