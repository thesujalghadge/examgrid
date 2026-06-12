"use client";

import { InstitutePaperUploadFlow } from "@/components/institute/institute-paper-upload-flow";

export default function InstituteTestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Test Creation Wizard</h2>
        <p className="text-sm text-[#5e5a52]">
          Configure, upload, review the student CBT experience, edit inline, and publish.
        </p>
      </div>
      <InstitutePaperUploadFlow />
    </div>
  );
}
