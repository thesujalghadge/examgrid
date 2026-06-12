"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getQuestionBank } from "@/services/question-bank-service";

export default function StudentPyqPage() {
  const bank = useMemo(() => getQuestionBank(), []);

  const bySubject = useMemo(() => {
    const map = new Map<string, number>();
    for (const question of bank) {
      map.set(question.subject, (map.get(question.subject) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [bank]);

  const byChapter = useMemo(() => {
    const map = new Map<string, number>();
    for (const question of bank) {
      map.set(`${question.subject} - ${question.chapter}`, (map.get(`${question.subject} - ${question.chapter}`) ?? 0) + 1);
    }
    return [...map.entries()].slice(0, 6);
  }, [bank]);

  const examWise = [
    { label: "JEE", count: bank.filter((question) => question.subject !== "Biology").length },
    { label: "NEET", count: bank.filter((question) => question.subject !== "Mathematics").length },
    { label: "CET", count: bank.filter((question) => question.subject !== "Biology").length },
  ];

  const mockWise = [
    { label: "Physics-Chemistry drill", count: bank.filter((question) => question.subject !== "Biology" && question.subject !== "Mathematics").length },
    { label: "Full STEM mix", count: bank.length },
    { label: "Biology focus", count: bank.filter((question) => question.subject === "Biology").length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">PYQ practice</h2>
        <p className="text-sm text-[#5e5a52]">
          Browse practice sets by exam, subject, chapter, or short mock drills.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <GroupingCard title="Exam-wise" rows={examWise} />
        <GroupingCard title="Subject-wise" rows={bySubject.map(([label, count]) => ({ label, count }))} />
        <GroupingCard title="Chapter-wise" rows={byChapter.map(([label, count]) => ({ label, count }))} />
        <GroupingCard title="Mock-test wise" rows={mockWise} />
      </div>
    </div>
  );
}

function GroupingCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; count: number }>;
}) {
  return (
    <Card className="border-[#d8d2c7]">
      <CardHeader>
        <CardTitle className="text-base text-[#14213d]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 ? (
          <p className="text-sm text-[#5e5a52]">No PYQs loaded yet.</p>
        ) : (
          rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between rounded-2xl border border-[#ece6da] p-3">
              <span className="text-sm text-[#14213d]">{row.label}</span>
              <span className="text-sm font-medium text-[#8a6f3e]">{row.count}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
