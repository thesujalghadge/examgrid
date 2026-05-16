"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isBuiltinExam, listAllExams } from "@/lib/exam-catalog";
import { examCatalogRepository } from "@/repositories/exam-catalog-repository";
import type { ExamDefinition } from "@/types/exam";

export default function AdminExamsPage() {
  const [exams, setExams] = useState<ExamDefinition[]>([]);

  const refresh = () => setExams(listAllExams());

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = (examId: string) => {
    if (isBuiltinExam(examId)) return;
    if (!confirm("Delete this exam from the catalog?")) return;
    examCatalogRepository.delete(examId);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Examinations</h1>
          <p className="text-sm text-gray-600">
            Published exams appear on the student portal automatically.
          </p>
        </div>
        <Link
          href="/admin/create-exam"
          className={cn(buttonVariants(), "bg-[#1a3c6e] text-white hover:bg-[#152d52]")}
        >
          Create exam
        </Link>
      </div>

      <div className="grid gap-4">
        {exams.map((exam) => (
          <Card key={exam.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base text-[#1a3c6e]">
                  {exam.title}
                </CardTitle>
                <p className="text-sm text-gray-600">{exam.subtitle}</p>
              </div>
              {isBuiltinExam(exam.id) && (
                <span className="mt-1 inline-block rounded bg-gray-200 px-2 py-0.5 text-[10px] font-medium">
                  Built-in demo
                </span>
              )}
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-600">
              <ul>
                <li>{exam.durationMinutes} min · {exam.totalQuestions} questions</li>
                <li>Sections: {exam.sections.map((s) => s.name).join(", ")}</li>
                <li>ID: {exam.id}</li>
              </ul>
              <div className="flex gap-2">
                <Link
                  href={`/exam/${exam.id}/instructions`}
                  className="text-sm text-[#1a3c6e] hover:underline"
                >
                  Preview (student)
                </Link>
                {!isBuiltinExam(exam.id) && (
                  <button
                    type="button"
                    className="text-sm text-red-600 hover:underline"
                    onClick={() => handleDelete(exam.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
