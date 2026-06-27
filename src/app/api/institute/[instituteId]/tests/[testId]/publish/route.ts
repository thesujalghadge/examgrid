import { NextResponse } from 'next/server';
import { enqueueSolutionsForExam } from '@/lib/background-jobs/queue-trigger';
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

import { assertInstituteUuid } from "@/config/institute";

import { isUuid } from "@/config/institute";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ instituteId: string; testId: string }> }
) {
  try {
    const { instituteId, testId } = await params;
    try {
      assertInstituteUuid(instituteId, "instituteId");
    } catch (e) {
      return NextResponse.json({ error: "INVALID_INSTITUTE_ID" }, { status: 400 });
    }

    // 1. Fetch exam to compute release time and resolve real UUID
    let query = supabase
      .from('exams')
      .select('id, scheduled_at, duration_minutes')
      .eq('institute_id', instituteId);
    
    if (isUuid(testId)) {
      query = query.eq('id', testId);
    } else {
      query = query.eq('legacy_id', testId);
    }

    const { data: exam, error: examError } = await query.single();

    if (examError || !exam) {
      return NextResponse.json({ error: "Exam not found" }, { status: 404 });
    }

    const actualExamId = exam.id;

    let releaseTime = new Date().toISOString();
    if (exam.scheduled_at) {
      const startMs = new Date(exam.scheduled_at).getTime();
      const durationMs = (exam.duration_minutes || 0) * 60 * 1000;
      const bufferMs = 5 * 60 * 1000; // 5 min join buffer
      releaseTime = new Date(startMs + durationMs + bufferMs).toISOString();
    }

    // 2. Mark exam as PUBLISHED and persist release time
    const { error: updateError } = await supabase
      .from('exams')
      .update({ is_published: true, solutions_release_time: releaseTime })
      .eq('id', actualExamId)
      .eq('institute_id', instituteId);

    if (updateError) {
      throw new Error(`Failed to mark exam as published: ${updateError.message}`);
    }

    // 2.5 FREEZE EXAM QUESTIONS (Immutable Snapshot)
    const { data: questions } = await supabase
      .from('exam_questions')
      .select('id, question_type, question_text, correct_option_id, correct_numerical_answer, options')
      .eq('exam_id', actualExamId);

    if (questions && questions.length > 0) {
      const qIds = questions.map(q => q.id);
      
      const { data: assets } = await supabase
        .from('test_question_assets')
        .select('exam_question_id, image_url')
        .in('exam_question_id', qIds);

      const assetMap = new Map(assets?.map(a => [a.exam_question_id, a.image_url]) || []);

      const now = new Date().toISOString();

      // Update sequentially (or Promise.all)
      await Promise.all(questions.map(async (q) => {
        let resolvedKey = "UNKNOWN";
        if (q.question_type === "MCQ" || q.question_type === "MCQ_SINGLE" || q.question_type === "MCQ_MULTIPLE") {
          const opt = (q.options || []).find((o: any) => o.id === q.correct_option_id);
          resolvedKey = opt ? (opt.text ? `${opt.label}: ${opt.text}`.trim() : opt.label) : "UNKNOWN";
        } else {
          resolvedKey = q.correct_numerical_answer || "UNKNOWN";
        }

        await supabase
          .from('exam_questions')
          .update({
            published_question_text: q.question_text,
            published_image_url: assetMap.get(q.id) || null,
            published_answer_key: resolvedKey,
            published_options: q.options,
            published_at: now
          })
          .eq('id', q.id)
          .is('published_at', null);
      }));
    }

    // 3. Trigger Queue (Idempotent)
    const result = await enqueueSolutionsForExam(actualExamId, instituteId);

    // Note: Background worker is no longer triggered here. 
    // It is processed by a distributed cron orchestrator.
    const expectedCount = questions ? questions.length : 0;
    const actualCount = result.enqueued + result.skipped;
    
    if (expectedCount > 0 && expectedCount !== actualCount) {
      throw new Error(`Queue verification failed: Expected ${expectedCount} queue rows but processed ${actualCount}`);
    }

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
