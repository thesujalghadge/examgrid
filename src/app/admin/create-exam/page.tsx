"use client";

import { CreateExamForm } from "@/components/admin/create-exam-form";

export default function AdminCreateExamPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Examination</h1>
        <p className="text-sm text-gray-600">
          Configure sections, assign questions from the bank, and publish to the
          student portal.
        </p>
      </div>
      <CreateExamForm />
    </div>
  );
}
