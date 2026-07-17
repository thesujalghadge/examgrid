import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentAnalyticsDashboardDTO } from "@/services/student-analytics-service";

export function OverallPerformance({ overall }: { overall: StudentAnalyticsDashboardDTO['overall'] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card className="border-[#d8d2c7] bg-[#fbf9f4]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[#5e5a52]">Questions Attempted</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[#14213d]">{overall.totalAttempted}</div>
        </CardContent>
      </Card>
      <Card className="border-[#d8d2c7] bg-[#fbf9f4]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[#5e5a52]">Overall Accuracy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[#14213d]">{(overall.accuracy * 100).toFixed(1)}%</div>
        </CardContent>
      </Card>
      <Card className="border-[#d8d2c7] bg-[#fbf9f4]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[#5e5a52]">Average Speed</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-[#14213d]">{Math.round(overall.avgTimeSeconds)}s / q</div>
        </CardContent>
      </Card>
      <Card className="border-[#d8d2c7] bg-[#fbf9f4]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-[#5e5a52]">Curriculum Coverage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-[#14213d] font-medium">
            {overall.subjectsCovered} Subjects
          </div>
          <div className="text-sm text-[#5e5a52]">
            {overall.chaptersCovered} Ch, {overall.topicsCovered} Topics
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
