"use client";

import { useCallback, useEffect, useState } from "react";
import { QuestionImportPanel } from "@/components/admin/question-import-panel";
import { CbtTestsManager } from "@/components/institute/cbt-tests-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuestionBank } from "@/services/question-bank-service";
import { getRepositories } from "@/lib/repositories/provider";

export default function InstituteTestsPage() {
  const [questionCount, setQuestionCount] = useState(0);
  const [testCount, setTestCount] = useState(0);

  const refresh = useCallback(() => {
    setQuestionCount(getQuestionBank().length);
    setTestCount(getRepositories().cbtTests.list().length);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Test operations</h2>
        <p className="text-sm text-[#5e5a52]">
          Keep the institute workflow linear: add source questions, configure the CBT, publish the schedule, then review results.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StepCard title="1. Source questions" detail="Use structured import or quick manual entry." />
        <StepCard title="2. Configure test" detail="Set duration, marks, batches, and schedule." />
        <StepCard title="3. Publish" detail="Open the test window for the assigned students." />
        <StepCard title="4. Review" detail="Track attempts and move to reports when complete." />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[#d8d2c7]">
          <CardHeader>
            <CardTitle className="text-base text-[#14213d]">Operational counts</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#ece6da] p-4">
              <p className="text-sm text-[#5e5a52]">Reusable questions</p>
              <p className="text-2xl font-semibold text-[#14213d]">{questionCount}</p>
            </div>
            <div className="rounded-2xl border border-[#ece6da] p-4">
              <p className="text-sm text-[#5e5a52]">Published tests</p>
              <p className="text-2xl font-semibold text-[#14213d]">{testCount}</p>
            </div>
          </CardContent>
        </Card>
        <QuestionImportPanel onImported={refresh} />
      </div>

      <CbtTestsManager />
    </div>
  );
}

function StepCard({ title, detail }: { title: string; detail: string }) {
  return (
    <Card className="border-[#d8d2c7] bg-white">
      <CardContent className="space-y-2 p-5">
        <p className="font-medium text-[#14213d]">{title}</p>
        <p className="text-sm text-[#5e5a52]">{detail}</p>
      </CardContent>
    </Card>
  );
}
