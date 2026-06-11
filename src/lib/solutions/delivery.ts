import { createClient } from "@supabase/supabase-js";

// We use the service role key to bypass RLS for this specific read-only aggregation,
// but we explicitly enforce security boundaries (auth, institute, attempt, release) in code.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BUCKET_NAME = "cbt-assets";

interface SolutionQueryOptions {
  examId: string;
  instituteId: string;
  studentId?: string; // If provided, acts as Student Request. If missing, acts as Teacher Request.
}

export async function fetchExamSolutions(options: SolutionQueryOptions) {
  const { examId, instituteId, studentId } = options;
  const isTeacherRequest = !studentId;

  try {
    // 1. Exam & Institute Check
    const { data: exam, error: examError } = await supabase
      .from("exams")
      .select("id, end_time")
      .eq("id", examId)
      .eq("institute_id", instituteId)
      .single();

    if (examError || !exam) {
      return { status: 404, payload: { error: "Exam not found or access denied." } };
    }

    // 2. Student Attempt Verification (Only for students)
    if (!isTeacherRequest) {
      const { data: attempt, error: attemptError } = await supabase
        .from("cbt_attempts")
        .select("id")
        .eq("test_id", examId)
        .eq("institute_id", instituteId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (attemptError || !attempt) {
        return { status: 403, payload: { error: "Access denied. Student has no recorded attempt for this exam." } };
      }
    }

    // 3. Release Check (Only for students)
    if (!isTeacherRequest) {
      const { data: settings } = await supabase
        .from("test_solution_settings")
        .select("release_mode, is_manually_released, scheduled_release_time")
        .eq("exam_id", examId)
        .eq("institute_id", instituteId)
        .maybeSingle();

      let isReleased = false;
      
      if (settings) {
        const now = new Date().getTime();
        switch (settings.release_mode) {
          case "AFTER_TEST_END":
            const endTimeMs = new Date(exam.end_time).getTime();
            if (now > endTimeMs) isReleased = true;
            break;
          case "MANUAL_RELEASE":
            if (settings.is_manually_released) isReleased = true;
            break;
          case "SCHEDULED_RELEASE":
            if (settings.scheduled_release_time && now > new Date(settings.scheduled_release_time).getTime()) {
              isReleased = true;
            }
            break;
        }
      }

      if (!isReleased) {
        // Locked responses return NO question payload.
        return { status: 200, payload: { releaseStatus: "LOCKED" } };
      }
    }

    // 4. Single N+1 Optimized Query
    // Fetch all test_question_assets joined with their question_solutions
    const { data: assets, error: assetsError } = await supabase
      .from("test_question_assets")
      .select(`
        question_number,
        storage_path,
        exam_question_id,
        asset_status,
        question_solutions (
          solution_text,
          generation_status,
          last_error
        )
      `)
      .eq("exam_id", examId)
      .eq("institute_id", instituteId)
      .order("question_number", { ascending: true });

    if (assetsError || !assets) {
      return { status: 500, payload: { error: "Failed to fetch solution assets." } };
    }

    // 5. Construct Payload
    const questions = assets.map((asset: any) => {
      // storage_path -> Internal Signed/Public URL conversion
      let imageUrl = null;
      if (asset.storage_path) {
        const { data } = supabase.storage.from(BUCKET_NAME).getPublicUrl(asset.storage_path);
        imageUrl = data.publicUrl;
      }

      const solutions = Array.isArray(asset.question_solutions) ? asset.question_solutions : [asset.question_solutions];
      const solution = solutions.find((s: any) => s); // usually just one
      
      const genStatus = solution?.generation_status || "PENDING";
      const isCompleted = genStatus === "COMPLETED";

      // Base student payload
      const item: any = {
        questionNumber: asset.question_number,
        imageUrl,
      };

      if (isCompleted) {
        item.status = "COMPLETED";
        item.solutionText = solution.solution_text;
      } else {
        item.status = "UNAVAILABLE";
        item.reason = "GENERATION_FAILED";
        item.solutionText = null;
      }

      // Teacher endpoints get more visibility
      if (isTeacherRequest) {
        item.generationStatus = genStatus;
        item.assetStatus = asset.asset_status;
        item.lastError = solution?.last_error;
      }

      return item;
    });

    return {
      status: 200,
      payload: {
        releaseStatus: "AVAILABLE",
        questions
      }
    };

  } catch (error: any) {
    console.error("fetchExamSolutions error:", error);
    return { status: 500, payload: { error: error.message || "Internal server error" } };
  }
}
