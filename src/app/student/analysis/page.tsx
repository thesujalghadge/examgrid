"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function StudentAnalysisPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Analysis</h2>
        <p className="text-sm text-[#5e5a52]">
          Deep timing and weak-topic intelligence will live here — separate from score reports.
        </p>
      </div>
      <Card className="border-[#d8d2c7] bg-[#fbf9f4]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Coming next</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[#5e5a52]">
          <p>Planned: L1/L2/L3 difficulty trends, time-per-question, revision priorities.</p>
          <p>Metadata is already prepared when institute uploads papers.</p>
          <p>Use Reports for scores and solutions today.</p>
        </CardContent>
      </Card>
    </div>
  );
}
