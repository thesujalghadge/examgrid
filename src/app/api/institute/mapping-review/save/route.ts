import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: NextRequest) {
  try {
    const instituteId = req.headers.get("x-institute-id") || req.cookies.get("institute_id")?.value;
    if (!instituteId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { mappingId, batchId, questionId, aiSubject, aiChapter, aiTopic, subjectId, chapterId, topicId } = body;

    if (!batchId || !questionId || !subjectId || !chapterId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Update question_syllabus_mappings
    const { error: mappingError } = await supabase
      .from("question_syllabus_mappings")
      .update({
        syllabus_subject_id: subjectId,
        syllabus_chapter_id: chapterId,
        syllabus_topic_id: topicId || null,
        mapping_confidence: 100,
        mapping_method: "MANUAL_CORRECTION",
        is_unmapped: false,
      })
      .eq("id", mappingId)
      .eq("institute_id", instituteId);

    if (mappingError) throw new Error(mappingError.message);

    // 2. Insert into syllabus_mapping_rules so it applies automatically next time
    if (aiSubject || aiChapter) {
      const { error: ruleError } = await supabase
        .from("syllabus_mapping_rules")
        .upsert({
          institute_id: instituteId,
          batch_id: batchId,
          ai_subject: aiSubject || "",
          ai_chapter: aiChapter || "",
          ai_topic: aiTopic || "",
          target_syllabus_subject_id: subjectId,
          target_syllabus_chapter_id: chapterId,
          target_syllabus_topic_id: topicId || null,
        }, { onConflict: "batch_id, ai_subject, ai_chapter, ai_topic" });

      if (ruleError) throw new Error(`Rule creation failed: ${ruleError.message}`);
    }

    // 3. Optional: Trigger mapping again to automatically resolve any other pending unmapped questions 
    // with the exact same AI metadata! We can do it async.
    fetch(`${req.nextUrl.origin}/api/internal/trigger-syllabus-mapping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchId, instituteId })
    }).catch(console.error);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Mapping correction save failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
