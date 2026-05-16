"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listAllExams } from "@/lib/exam-catalog";
import { getQuestionBank } from "@/services/question-bank-service";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState({ questions: 0, exams: 0 });

  useEffect(() => {
    setStats({
      questions: getQuestionBank().length,
      exams: listAllExams().length,
    });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-sm text-gray-600">
          Manage question bank and institute examinations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
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
    </div>
  );
}
