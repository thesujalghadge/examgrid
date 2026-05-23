"use client";

import { InstitutePaperUploadFlow } from "@/components/institute/institute-paper-upload-flow";

export default function InstituteTestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Conduct a CBT</h2>
        <p className="text-sm text-[#5e5a52]">
          Upload your institute question paper and answer key, preview the generated test, assign
          batches, and publish — the way coaching centres actually run weekly tests.
        </p>
      </div>
      <InstitutePaperUploadFlow />
    </div>
  );
}
