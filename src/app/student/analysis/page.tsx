import { fetchStudentCurriculumAnalytics } from "../actions/analytics-curriculum-fetch";
import { OverallPerformance } from "@/components/student/analysis/OverallPerformance";
import { StrengthWeaknessList } from "@/components/student/analysis/StrengthWeaknessList";
import { SpeedAnalysis } from "@/components/student/analysis/SpeedAnalysis";
import { CurriculumExplorer } from "@/components/student/analysis/CurriculumExplorer";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = 'force-dynamic';

export default async function StudentAnalysisPage() {
  const data = await fetchStudentCurriculumAnalytics();

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#14213d]">Analysis</h2>
          <p className="text-sm text-[#5e5a52]">Curriculum insights are currently unavailable.</p>
        </div>
      </div>
    );
  }

  if (data.overall.totalAttempted === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-[#14213d]">Analysis</h2>
          <p className="text-sm text-[#5e5a52]">Actionable intelligence built from your exam attempts.</p>
        </div>
        <Card className="border-[#d8d2c7] bg-white text-center py-12">
          <CardContent>
            <h3 className="text-xl font-semibold text-[#14213d] mb-2">Welcome to Analytics</h3>
            <p className="text-sm text-[#5e5a52]">
              You haven't attempted any classified questions yet. Once you complete a test, your personalized strengths, weaknesses, and speed metrics will appear here.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Curriculum Analytics</h2>
        <p className="text-sm text-[#5e5a52]">Actionable intelligence built from your exam attempts.</p>
      </div>

      <OverallPerformance overall={data.overall} />

      {/* Hide Strengths/Weaknesses if they haven't answered at least 5 questions on a single topic yet, 
          as they'll just see empty states, though empty states are gracefully handled by the component. */}
      <StrengthWeaknessList strengths={data.topStrengths} weaknesses={data.topWeaknesses} />

      <SpeedAnalysis speedAnalysis={data.speedAnalysis} />

      <CurriculumExplorer curriculum={data.curriculum} />
    </div>
  );
}
