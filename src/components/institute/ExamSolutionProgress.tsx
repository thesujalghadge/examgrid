"use client";

import { useEffect, useState } from "react";
import { getExamSolutionProgress } from "@/app/institute/actions/solution-overview";

export function ExamSolutionProgress({ testId, totalQuestions }: { testId: string; totalQuestions: number }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!testId) return;
    getExamSolutionProgress(testId).then((res) => {
      setData(res);
    });
  }, [testId]);

  if (!data) return null;

  const total = data.total_questions || totalQuestions;
  const generated = data.completed_solutions || 0;
  const pending = data.pending_solutions || 0;
  const failed = data.failed_solutions || 0;
  const percent = total > 0 ? Math.round((generated / total) * 100) : 0;

  return (
    <div className="rounded-xl border border-[#ece6da] bg-white p-4 mt-4">
      <h3 className="text-sm font-semibold text-[#14213d] uppercase tracking-wider mb-2">Solutions Progress</h3>
      
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-[#14213d]">{generated} / {total} Generated</span>
        <span className="text-sm font-medium text-[#5e5a52]">{percent}%</span>
      </div>
      
      <div className="w-full bg-[#ece6da] rounded-full h-2.5 mb-4">
        <div className="bg-[#8a6f3e] h-2.5 rounded-full" style={{ width: `${percent}%` }}></div>
      </div>

      <div className="flex gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
          <span className="text-[#5e5a52]">Pending: {pending}</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          <span className="text-[#5e5a52]">Failed: {failed}</span>
        </div>
      </div>
    </div>
  );
}
