"use client";

import { InstituteAnalysisPanel } from "@/components/institute/institute-analysis-panel";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function InstituteAnalysisPage() {
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? "");

  if (!instituteId) {
    return <p className="text-sm text-[#5e5a52]">Institute context required.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Analysis</h2>
        <p className="text-sm text-[#5e5a52]">
          Institute, batch, student, subject, and chapter views from real test data.
        </p>
      </div>
      <InstituteAnalysisPanel instituteId={instituteId} />
    </div>
  );
}
