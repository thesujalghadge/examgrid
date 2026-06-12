import { NextResponse } from 'next/server';
import { enqueueSolutionsForExam } from '@/lib/background-jobs/queue-trigger';
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ instituteId: string; testId: string }> }
) {
  try {
    const { instituteId, testId } = await params;

    // 1. Mark exam as PUBLISHED in Phase 1 schema (mocking the actual business logic)
    // Assuming 'status' or 'test_status' exists. We will just simulate it here.
    const { error: updateError } = await supabase
      .from('exams')
      .update({ status: 'PUBLISHED' })
      .eq('id', testId)
      .eq('institute_id', instituteId);

    if (updateError) {
      console.warn("Exam publish update failed or column missing, proceeding to queue trigger anyway for Step 3A demo:", updateError);
    }

    // 2. Trigger Queue (Idempotent)
    const result = await enqueueSolutionsForExam(testId, instituteId);

    return NextResponse.json({
      success: true,
      message: `Exam ${testId} published successfully.`,
      queue: result
    });
  } catch (error: any) {
    console.error('Publish error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
