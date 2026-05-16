"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { listAllExams } from "@/lib/exam-catalog";
import { useAuthStore } from "@/stores/auth-store";

export default function ExamsPage() {
  const router = useRouter();
  const candidate = useAuthStore((s) => s.candidate);
  const logout = useAuthStore((s) => s.logout);
  const [exams, setExams] = useState<ReturnType<typeof listAllExams>>([]);

  useEffect(() => {
    if (!candidate) router.replace("/login");
  }, [candidate, router]);

  useEffect(() => {
    setExams(listAllExams());
  }, []);

  if (!candidate) return null;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="border-b bg-[#1a3c6e] px-6 py-4 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Upcoming Examinations</h1>
            <p className="text-sm text-blue-100">
              Welcome, {candidate.name} (Roll: {candidate.rollNumber})
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-white/40 bg-transparent text-white hover:bg-white/10"
            onClick={() => {
              logout();
              router.push("/login");
            }}
          >
            Logout
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-6">
        <p className="mb-4 text-sm text-gray-600">
          Select an examination to view instructions and begin your CBT session.
        </p>
        <div className="grid gap-4">
          {exams.map((exam) => (
            <Card key={exam.id} className="border-gray-300">
              <CardHeader>
                <CardTitle className="text-[#1a3c6e]">{exam.title}</CardTitle>
                <CardDescription>
                  {exam.subtitle}
                  {exam.id.startsWith("exam-") && (
                    <span className="ml-2 rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-800">
                      Institute
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <ul className="text-sm text-gray-600">
                  <li>Duration: {exam.durationMinutes} minutes</li>
                  <li>Questions: {exam.totalQuestions}</li>
                  <li>Sections: {exam.sections.map((s) => s.name).join(", ")}</li>
                  <li>
                    Scheduled:{" "}
                    {new Date(exam.scheduledAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </li>
                </ul>
                <Link
                  href={`/exam/${exam.id}/instructions`}
                  className={cn(
                    buttonVariants(),
                    "bg-[#1a3c6e] text-white hover:bg-[#152d52]",
                  )}
                >
                  Proceed to Instructions
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
