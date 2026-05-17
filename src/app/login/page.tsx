"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_INSTITUTE } from "@/config/demo";
import { DEMO_LOGIN } from "@/data/demo-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductMark } from "@/components/shared/product-ui";
import { getRepositories } from "@/lib/repositories/provider";
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [name, setName] = useState<string>(DEMO_LOGIN.studentName);
  const [rollNumber, setRollNumber] = useState<string>(DEMO_LOGIN.studentRoll);
  const [applicationNumber, setApplicationNumber] = useState<string>(
    DEMO_LOGIN.applicationNumber,
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const roster = getRepositories().students.list();
    const matched = getRepositories().students.getByRollNumber(rollNumber);
    if (roster.length > 0 && !matched) {
      setError("No active institute student found for this roll number.");
      return;
    }
    if (matched && !matched.active) {
      setError("This student account is inactive. Contact the institute admin.");
      return;
    }
    login({
      name: matched?.fullName ?? name,
      rollNumber,
      applicationNumber,
      studentId: matched?.id,
      batchId: matched?.batchId,
      courseType: matched?.courseType,
    });
    router.push("/exams");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--eg-canvas)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <ProductMark subtitle="Student examination portal" />
        </div>
        <div className="eg-card overflow-hidden shadow-md">
          <div className="border-b border-[var(--eg-cbt)]/20 bg-[var(--eg-cbt)] px-6 py-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-100/90">
              {DEMO_INSTITUTE.name}
            </p>
            <h1 className="mt-1 text-lg font-semibold">CBT Examination Login</h1>
            <p className="mt-1 text-sm text-blue-100/90">
              Enter your credentials to access assigned tests.
            </p>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Candidate name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="roll">Roll number</Label>
                <Input
                  id="roll"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="app">Application number</Label>
                <Input
                  id="app"
                  value={applicationNumber}
                  onChange={(e) => setApplicationNumber(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <Button
                type="submit"
                className="h-10 w-full bg-[var(--eg-cbt)] hover:bg-[var(--eg-cbt-hover)]"
              >
                Login to examination system
              </Button>
              {error && <p className="text-sm text-red-700">{error}</p>}
            </form>
            <p className="mt-5 text-center text-xs text-slate-500">
              Demo roll: {DEMO_LOGIN.studentRoll}
            </p>
            <p className="mt-3 text-center text-xs">
              <Link href="/" className="text-[var(--eg-cbt)] hover:underline">
                ← Back to ExamGrid
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

