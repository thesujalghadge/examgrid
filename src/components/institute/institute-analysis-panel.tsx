"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRepositories } from "@/lib/repositories/provider";
import { getQuestionBank } from "@/services/question-bank-service";
import { scopeByInstituteId } from "@/lib/tenant-scope";

type Tab = "overall" | "batches" | "students" | "subjects" | "chapters";

export function InstituteAnalysisPanel({ instituteId }: { instituteId: string }) {
  const [tab, setTab] = useState<Tab>("overall");

  const data = useMemo(() => {
    const repos = getRepositories();
    const students = scopeByInstituteId(repos.students.list(), instituteId);
    const batches = scopeByInstituteId(repos.batches.list(), instituteId);
    const tests = repos.cbtTests.list().filter((t) => t.instituteId === instituteId);
    const bank = new Map(getQuestionBank().map((q) => [q.id, q]));

    const attempts = tests.flatMap((t) => repos.cbtAttempts.listByTestId(t.id));
    const avgScore =
      attempts.length > 0
        ? attempts.reduce((s, a) => s + (a.attempt.score ?? 0), 0) / attempts.length
        : 0;

    const byBatch = batches.map((batch) => {
      const rolls = new Set(
        students.filter((s) => s.batchId === batch.id).map((s) => s.rollNumber),
      );
      const batchAttempts = attempts.filter((a) => rolls.has(a.attempt.studentId));
      const avg =
        batchAttempts.length > 0
          ? batchAttempts.reduce((s, a) => s + (a.attempt.score ?? 0), 0) /
            batchAttempts.length
          : 0;
      return { name: batch.name, attempts: batchAttempts.length, avg };
    });

    const byStudent = students.map((student) => {
      const studentAttempts = attempts.filter(
        (a) => a.attempt.studentId === student.rollNumber,
      );
      const avg =
        studentAttempts.length > 0
          ? studentAttempts.reduce((s, a) => s + (a.attempt.score ?? 0), 0) /
            studentAttempts.length
          : 0;
      return { name: student.fullName, roll: student.rollNumber, attempts: studentAttempts.length, avg };
    });

    const subjectMiss = new Map<string, { wrong: number; total: number }>();
    const chapterMiss = new Map<string, { wrong: number; total: number }>();

    for (const row of attempts) {
      const test = tests.find((t) => t.id === row.attempt.testId);
      if (!test) continue;
      for (const resp of row.responses) {
        const tq = test.questions.find((q) => q.questionId === resp.questionId);
        const bq = tq?.bankQuestionId ? bank.get(tq.bankQuestionId) : null;
        const subject = bq?.subject ?? "Unknown";
        const chapter = bq ? `${bq.subject} — ${bq.chapter}` : "Unknown";
        const bump = (map: Map<string, { wrong: number; total: number }>, key: string) => {
          const cur = map.get(key) ?? { wrong: 0, total: 0 };
          cur.total += 1;
          if (!resp.isCorrect) cur.wrong += 1;
          map.set(key, cur);
        };
        bump(subjectMiss, subject);
        bump(chapterMiss, chapter);
      }
    }

    return {
      tests: tests.length,
      students: students.length,
      submissions: attempts.length,
      avgScore,
      byBatch,
      byStudent,
      subjects: [...subjectMiss.entries()].map(([label, v]) => ({
        label,
        rate: v.total > 0 ? v.wrong / v.total : 0,
        total: v.total,
      })),
      chapters: [...chapterMiss.entries()]
        .map(([label, v]) => ({
          label,
          rate: v.total > 0 ? v.wrong / v.total : 0,
          total: v.total,
        }))
        .sort((a, b) => b.rate - a.rate)
        .slice(0, 12),
    };
  }, [instituteId]);

  const tabs: { id: Tab; label: string }[] = [
    { id: "overall", label: "Overall" },
    { id: "batches", label: "Batches" },
    { id: "students", label: "Students" },
    { id: "subjects", label: "Subjects" },
    { id: "chapters", label: "Chapters" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              tab === t.id
                ? "rounded-full bg-[#14213d] px-4 py-1.5 text-sm font-medium text-white"
                : "rounded-full border border-[#ece6da] px-4 py-1.5 text-sm text-[#5e5a52]"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overall" && (
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="Tests" value={String(data.tests)} />
          <Metric label="Students" value={String(data.students)} />
          <Metric label="Submissions" value={String(data.submissions)} />
          <Metric label="Avg score" value={data.avgScore.toFixed(1)} />
        </div>
      )}

      {tab === "batches" && <Table rows={data.byBatch.map((b) => ({
        col1: b.name,
        col2: String(b.attempts),
        col3: b.avg.toFixed(1),
      }))} headers={["Batch", "Submissions", "Avg score"]} empty="Add batches and run tests." />}

      {tab === "students" && <Table rows={data.byStudent.map((s) => ({
        col1: s.name,
        col2: s.roll,
        col3: String(s.attempts),
        col4: s.avg.toFixed(1),
      }))} headers={["Student", "Roll", "Tests", "Avg"]} empty="No student submissions yet." />}

      {tab === "subjects" && <RateList items={data.subjects} empty="Subject breakdown appears after attempts." />}

      {tab === "chapters" && <RateList items={data.chapters} empty="Chapter breakdown appears after attempts." />}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-[#d8d2c7]">
      <CardHeader>
        <CardTitle className="text-sm text-[#5e5a52]">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold text-[#14213d]">{value}</CardContent>
    </Card>
  );
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[];
  rows: Array<{ col1: string; col2: string; col3?: string; col4?: string }>;
  empty: string;
}) {
  return (
    <Card className="border-[#d8d2c7]">
      <CardContent className="pt-6">
        {rows.length === 0 ? (
          <p className="text-sm text-[#5e5a52]">{empty}</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[#5e5a52]">
                {headers.map((h) => (
                  <th key={h} className="pb-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.col1 + r.col2} className="border-b border-[#f1ece4]">
                  <td className="py-2">{r.col1}</td>
                  <td className="py-2">{r.col2}</td>
                  {r.col3 != null ? <td className="py-2">{r.col3}</td> : null}
                  {r.col4 != null ? <td className="py-2">{r.col4}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function RateList({
  items,
  empty,
}: {
  items: Array<{ label: string; rate: number; total: number }>;
  empty: string;
}) {
  return (
    <Card className="border-[#d8d2c7]">
      <CardContent className="space-y-3 pt-6">
        {items.length === 0 ? (
          <p className="text-sm text-[#5e5a52]">{empty}</p>
        ) : (
          items.map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-xl border border-[#ece6da] p-3 text-sm"
            >
              <span className="text-[#14213d]">{item.label}</span>
              <span className="text-[#5e5a52]">
                {(item.rate * 100).toFixed(0)}% incorrect ({item.total} responses)
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
