"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_INSTITUTE } from "@/config/demo";
import { listAllExams } from "@/lib/exam-catalog";
import { getRepositories } from "@/lib/repositories/provider";
import { resetAndReseedDemoEnvironment } from "@/services/demo-environment-service";
import { getQuestionBank } from "@/services/question-bank-service";

export default function AdminOverviewPage() {
  const [stats] = useState(() => {
    const repos = getRepositories();
    return {
      questions: getQuestionBank().length,
      exams: listAllExams().length,
      students: repos.students.list().length,
      batches: repos.batches.list().length,
      schedules: repos.schedules.list().length,
    };
  });
  const [seeding, setSeeding] = useState(false);

  const reseedDemo = async () => {
    if (!confirm("Reset and reseed the Apex JEE Academy demo environment?")) return;
    setSeeding(true);
    await resetAndReseedDemoEnvironment();
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-sm text-gray-600">
          {DEMO_INSTITUTE.name} · {DEMO_INSTITUTE.tagline}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-5">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Students</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#1a3c6e]">{stats.students}</p>
            <Link href="/admin/students" className="text-sm text-[#1a3c6e] hover:underline">
              Manage students →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Batches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#1a3c6e]">{stats.batches}</p>
            <Link href="/admin/batches" className="text-sm text-[#1a3c6e] hover:underline">
              Manage batches →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Question Bank</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#1a3c6e]">{stats.questions}</p>
            <Link href="/admin/questions" className="text-sm text-[#1a3c6e] hover:underline">
              Manage questions →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#1a3c6e]">{stats.schedules}</p>
            <Link href="/admin/schedules" className="text-sm text-[#1a3c6e] hover:underline">
              Schedule exams →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#1a3c6e]">{stats.exams}</p>
            <Link href="/admin/exams" className="text-sm text-[#1a3c6e] hover:underline">
              View exams →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Create Exam</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href="/admin/create-exam"
              className="inline-block rounded bg-[#1a3c6e] px-4 py-2 text-sm font-medium text-white hover:bg-[#152d52]"
            >
              New examination
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Demo Environment</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-900">Apex JEE Academy demo mode</p>
            <p>
              Seeds realistic batches, students, JEE/NEET/CET exams, schedules,
              and question bank data for institute walkthroughs.
            </p>
          </div>
          <Button onClick={() => void reseedDemo()} disabled={seeding}>
            {seeding ? "Seeding…" : "Reset & Seed Demo"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
