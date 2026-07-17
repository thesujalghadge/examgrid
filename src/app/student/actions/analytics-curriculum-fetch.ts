"use server";

import { StudentAnalyticsService, StudentAnalyticsDashboardDTO } from "@/services/student-analytics-service";
import { readVerifiedWorkspaceSession } from "@/lib/workspace-session-server";

export async function fetchStudentCurriculumAnalytics(): Promise<StudentAnalyticsDashboardDTO | null> {
  const session = await readVerifiedWorkspaceSession();
  if (!session || session.role !== "student") {
    return null;
  }

  try {
    // 1. Fetch student_id from workspace session
    const studentId = session.userId;

    // 2. Delegate to Service Layer
    return await StudentAnalyticsService.getDashboard(studentId);
  } catch (err) {
    console.error("Error fetching student curriculum analytics:", err);
    return null;
  }
}
