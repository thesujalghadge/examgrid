"use client";

import { PlatformInstitutesManager } from "@/components/platform/platform-institutes-manager";

export default function PlatformInstitutesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Institutes</h2>
        <p className="text-sm text-[#5e5a52]">
          Add, activate, deactivate, and remove coaching institutes on the platform.
        </p>
      </div>
      <PlatformInstitutesManager />
    </div>
  );
}
