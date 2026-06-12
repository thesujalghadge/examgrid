"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExamInterface } from "@/components/exam/ExamInterface";
import { ExamInstructions } from "@/components/exam/ExamInstructions";
import { getExamById } from "@/lib/exam-catalog";
import { ensureExamReadyForCbt } from "@/lib/cbt/session-safety";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { getRepositories } from "@/lib/repositories/provider";
import {
  canCandidateAccessExam,
  isOperationalSchedulingActive,
} from "@/services/institute-ops-service";

export default function StudentCbtTestTakePage() {
  const params = useParams();
  const testId = params.testId as string;
  const router = useRouter();
  const candidate = useAuthStore((s) => s.candidate);
  const hydrateWs = useWorkspaceAuthStore((s) => s.hydrate);
  const [started, setStarted] = useState(false);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const wsSession = useWorkspaceAuthStore((s) => s.session);

  useEffect(() => {
    hydrateWs();
  }, [hydrateWs]);

  useEffect(() => {
    if (!candidate || (wsSession && wsSession.role !== "student")) {
      router.replace("/student/login");
      return;
    }
    const examDef = getExamById(testId);
    if (
      !examDef ||
      !ensureExamReadyForCbt(examDef) ||
      (isOperationalSchedulingActive() && !canCandidateAccessExam(candidate, testId))
    ) {
      setAllowed(false);
      return;
    }
    setAllowed(true);
  }, [candidate, router, testId]);

  if (!candidate || allowed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-200 text-sm text-gray-600">
        Checking access...
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-200 p-4">
        <p className="text-sm text-gray-700">You cannot access this test.</p>
        <Button variant="outline" onClick={() => router.replace("/student/tests")}>
          Back
        </Button>
      </div>
    );
  }

  if (!started) {
    const test = getExamById(testId);
    if (!test) return null;
    return (
      <ExamInstructions 
        exam={test} 
        onProceed={() => setStarted(true)} 
      />
    );
  }

  return (
    <ExamInterface
      examId={testId}
      navigate={{
        result: (id) => `/student/tests/${id}/result`,
        unauthorized: "/student/tests",
        login: "/student/login",
      }}
    />
  );
}
