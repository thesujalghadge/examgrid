import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function enqueueSolutionsForExam(examId: string, instituteId: string) {
  // 1. Fetch all UPLOADED assets for this exam
  const { data: assets, error: assetsError } = await supabase
    .from("test_question_assets")
    .select("id, asset_status, exam_question_id")
    .eq("exam_id", examId);

  if (assetsError || !assets) {
    throw new Error(`Failed to fetch assets for exam ${examId}`);
  }

  const uploadedAssets = assets.filter(a => a.asset_status === "UPLOADED");
  
  if (uploadedAssets.length === 0) {
    return { enqueued: 0, skipped: assets.length };
  }

  // 2. Prepare queue items
  // Note: relying on ON CONFLICT DO NOTHING using the UNIQUE(test_question_asset_id) constraint
  const queueItems = uploadedAssets.map(asset => ({
    institute_id: instituteId,
    test_question_asset_id: asset.id,
    question_id: asset.exam_question_id, // For backward compatibility if needed, though asset_id is authoritative now
    status: "PENDING",
    priority: 100
  }));

  // 3. Insert into queue idempotently
  const { error: insertError } = await supabase
    .from("solution_generation_queue")
    .upsert(queueItems, { onConflict: "test_question_asset_id", ignoreDuplicates: true });

  if (insertError) {
    throw new Error(`Failed to enqueue solutions: ${insertError.message}`);
  }

  return {
    enqueued: queueItems.length, // Upsert ignores duplicates silently in count usually, but we consider the intent
    skipped: assets.length - uploadedAssets.length
  };
}
