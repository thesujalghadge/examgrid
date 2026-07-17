import { createClient } from "@supabase/supabase-js";

// We use the service role key to bypass RLS for this specific read-only aggregation,
// but we explicitly enforce security boundaries (auth, institute, schedule, release) in code.
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
      .select("id, solutions_release_time")
      .eq("id", examId)
      .eq("institute_id", instituteId)
      .single();

    if (examError || !exam) {
      return { status: 404, payload: { error: "Exam not found or access denied." } };
    }

    // 2. Student schedule verification and release check (Only for students)
    if (!isTeacherRequest) {
      const { data: student } = await supabase
        .from("students")
        .select("id, batch_id, is_active")
        .eq("id", studentId)
        .eq("institute_id", instituteId)
        .maybeSingle();

      if (!student || !student.is_active) {
        return { status: 403, payload: { error: "Access denied. Student is not active in this institute." } };
      }

      const { data: schedules, error: scheduleError } = await supabase
        .from("exam_schedules")
        .select("id, end_at, solutions_release_time, visibility_rule")
        .eq("exam_id", examId)
        .eq("institute_id", instituteId)
        .eq("is_active", true);

      if (scheduleError || !schedules || schedules.length === 0) {
        return { status: 403, payload: { error: "Access denied. Exam schedule is not available." } };
      }

      const assignedScheduleIds = schedules
        .filter((schedule: any) => schedule.visibility_rule === "assigned_batches")
        .map((schedule: any) => schedule.id);
      const assignedBatchLinks = assignedScheduleIds.length > 0 && student.batch_id
        ? await supabase
            .from("exam_schedule_batches")
            .select("schedule_id")
            .in("schedule_id", assignedScheduleIds)
            .eq("batch_id", student.batch_id)
            .eq("institute_id", instituteId)
        : { data: [], error: null };

      if (assignedBatchLinks.error) {
        return { status: 403, payload: { error: "Access denied. Exam schedule is not available." } };
      }

      const accessibleAssignedSchedules = new Set((assignedBatchLinks.data ?? []).map((row: any) => row.schedule_id));
      const accessibleSchedules = schedules.filter((schedule: any) =>
        schedule.visibility_rule === "all_active_students" || accessibleAssignedSchedules.has(schedule.id),
      );

      if (accessibleSchedules.length === 0) {
        return { status: 403, payload: { error: "Access denied. Student is not assigned to this exam." } };
      }

      const now = Date.now();
      const isReleased = accessibleSchedules.some((schedule: any) => {
        const endTime = new Date(schedule.end_at).getTime();
        const releaseTime = new Date(schedule.solutions_release_time ?? exam.solutions_release_time ?? schedule.end_at).getTime();
        return now >= endTime && now >= releaseTime;
      });

      if (!isReleased) {
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
