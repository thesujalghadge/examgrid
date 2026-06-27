import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyE2E(examId: string, studentId?: string) {
  console.log(`\n======================================================`);
  console.log(` E2E VERIFICATION REPORT FOR EXAM: ${examId}`);
  console.log(`======================================================\n`);

  // 1. Verify Exam Creation
  const { data: exam, error: examErr } = await supabase
    .from("exams")
    .select("*, exam_sections(id, name, total_questions)")
    .eq("id", examId)
    .single();

  if (examErr || !exam) {
    console.error(`❌ Exam not found: ${examErr?.message || "Unknown error"}`);
    return;
  }
  console.log(`✅ EXAM FOUND: ${exam.title} (${exam.exam_type})`);
  console.log(`   Total Questions Expected: ${exam.total_questions}`);
  console.log(`   Sections: ${exam.exam_sections?.length || 0}`);

  // 2. Verify Questions Extracted
  const { data: questions, error: qErr } = await supabase
    .from("exam_questions")
    .select("id, question_number, question_type, section_id")
    .eq("exam_id", examId);

  if (qErr) {
    console.error(`❌ Error fetching questions: ${qErr.message}`);
  } else {
    console.log(`\n✅ QUESTIONS EXTRACTED: ${questions.length} / ${exam.total_questions}`);
    if (questions.length !== exam.total_questions) {
      console.warn(`   ⚠️ Warning: Extracted questions do not match total_questions limit.`);
    }

    // Verify Syllabus Mappings Present
    if (questions.length > 0) {
      const qIds = questions.map(q => q.id);
      const { data: mappings, error: mapErr } = await supabase
        .from("question_syllabus_mappings")
        .select("question_id")
        .in("question_id", qIds);
      
      if (mapErr) {
        console.error(`❌ Error fetching mappings: ${mapErr.message}`);
      } else {
        console.log(`✅ SYLLABUS MAPPINGS: ${mappings?.length || 0} / ${questions.length}`);
      }
    }
  }

  // 3. Verify Solutions Generated (from queue/solutions)
  if (questions && questions.length > 0) {
    const qIds = questions.map(q => q.id);
    const { data: solutions, error: solErr } = await supabase
      .from("question_solutions")
      .select("id, question_id, is_verified")
      .in("question_id", qIds);
      
    if (solErr) {
      console.error(`❌ Error fetching solutions: ${solErr.message}`);
    } else {
      console.log(`\n✅ SOLUTIONS GENERATED: ${solutions?.length || 0} / ${questions.length}`);
      const verified = solutions?.filter(s => s.is_verified).length || 0;
      console.log(`   Verified Solutions: ${verified}`);
    }
  }

  // 4. Verify Attempts
  const attemptQuery = supabase
    .from("cbt_attempts")
    .select("id, student_id, status, total_questions, attempted_questions, score");
  
  if (studentId) attemptQuery.eq("student_id", studentId);
  // Match test_id correctly based on our CBT naming
  attemptQuery.ilike("test_id", `%${examId}%`);

  const { data: attempts, error: attErr } = await attemptQuery;

  if (attErr) {
    console.error(`❌ Error fetching attempts: ${attErr.message}`);
  } else {
    console.log(`\n✅ CBT ATTEMPTS: ${attempts?.length || 0}`);
    attempts?.forEach((att, i) => {
      console.log(`   [Attempt ${i+1}] Student: ${att.student_id} | Status: ${att.status} | Score: ${att.score} | Attempted: ${att.attempted_questions}/${att.total_questions}`);
    });

    if (attempts && attempts.length > 0) {
      const attemptIds = attempts.map(a => a.id);
      
      // Verify Results (Rankings & Percentiles)
      const { data: results, error: resErr } = await supabase
        .from("cbt_results")
        .select("id, attempt_id, rank, percentile, total_candidates")
        .in("attempt_id", attemptIds);

      if (resErr) {
        console.error(`❌ Error fetching cbt_results: ${resErr.message}`);
      } else {
        console.log(`\n✅ RANKINGS & PERCENTILES: ${results?.length || 0}`);
        results?.forEach(r => {
          console.log(`   [Result] Rank: ${r.rank || '-'} / ${r.total_candidates || '-'} | Percentile: ${r.percentile || '-'}%`);
        });
      }

      // 5. Verify Responses Stored
      const { data: answers, error: ansErr } = await supabase
        .from("cbt_attempt_answers")
        .select("id, attempt_id, is_correct, time_taken_seconds, marked_for_review")
        .in("attempt_id", attemptIds);

      if (ansErr) {
        console.error(`❌ Error fetching answers: ${ansErr.message}`);
      } else {
        console.log(`\n✅ RESPONSES STORED: ${answers?.length || 0} total answers recorded across attempts`);
      }

      // 6. Verify Analytics Queued
      const { data: jobs, error: jobErr } = await supabase
        .from("analytics_jobs")
        .select("id, status, error_message")
        .in("attempt_id", attemptIds);

      if (jobErr) {
        console.error(`❌ Error fetching analytics jobs: ${jobErr.message}`);
      } else {
        console.log(`\n✅ ANALYTICS JOBS: ${jobs?.length || 0}`);
        jobs?.forEach(j => {
          console.log(`   Job Status: ${j.status} ${j.error_message ? `(Error: ${j.error_message})` : ''}`);
        });
      }

      // 7. Verify Exam Analytics & Cumulative Analytics (if studentId provided)
      if (studentId) {
        const { data: examAna, error: eaErr } = await supabase
          .from("student_chapter_analytics")
          .select("total_attempted, correct_count, incorrect_count")
          .eq("student_id", studentId)
          .eq("exam_id", examId);
          
        if (eaErr) {
           console.error(`❌ Error fetching exam analytics: ${eaErr.message}`);
        } else {
           console.log(`\n✅ EXAM ANALYTICS GENERATED (Chapters): ${examAna?.length || 0} records.`);
        }

        const { data: cumu, error: cumuErr } = await supabase
          .from("student_cumulative_chapter_analytics")
          .select("total_attempted, total_correct, overall_accuracy")
          .eq("student_id", studentId);
        
        if (cumuErr) {
           console.error(`❌ Error fetching cumulative: ${cumuErr.message}`);
        } else {
           console.log(`\n✅ CUMULATIVE ANALYTICS (Chapters): ${cumu?.length || 0} records updated for student.`);
        }
        
        // 8. Verify Recommendations
        const { data: recs, error: recErr } = await supabase
          .from("student_recommendations")
          .select("code, payload")
          .eq("student_id", studentId);
          
        if (recErr) {
           console.error(`❌ Error fetching recommendations: ${recErr.message}`);
        } else {
           console.log(`\n✅ RECOMMENDATIONS: ${recs?.length || 0} active recommendations`);
           recs?.slice(0, 3).forEach(r => console.log(`   -> ${r.code} (Attempts: ${r.payload?.attempts}, Acc: ${r.payload?.accuracy}%)`));
        }
      }
    }
  }
  
  console.log(`\n======================================================\n`);
}

const targetExamId = process.argv[2];
const targetStudentId = process.argv[3]; // Optional

if (!targetExamId) {
  console.error("Usage: npx tsx scripts/verify_e2e.ts <exam_id> [student_id]");
  process.exit(1);
}

verifyE2E(targetExamId, targetStudentId).catch(console.error);
