import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StudentTestsPage from "@/app/student/tests/page";

export default function StudentDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Dashboard</h1>
        <p className="text-sm text-gray-600">
          Focused view for your upcoming tests, progress, and practice pipeline.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {["Assigned Tests", "Practice Streak", "Performance Trend"].map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardTitle className="text-base">{item}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-600">
              Student-scoped metric placeholder.
            </CardContent>
          </Card>
        ))}
      </div>
      <StudentTestsPage />
    </div>
  );
}
