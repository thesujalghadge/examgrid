"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_INSTITUTE } from "@/config/demo";
import { DEMO_LOGIN } from "@/data/demo-data";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getRepositories } from "@/lib/repositories/provider";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function StudentLoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const workspaceLogin = useWorkspaceAuthStore((s) => s.login);
  const workspaceLogout = useWorkspaceAuthStore((s) => s.logout);
  const [rollNumber, setRollNumber] = useState<string>(DEMO_LOGIN.studentRoll);
  const [applicationNumber, setApplicationNumber] = useState<string>(
    DEMO_LOGIN.applicationNumber,
  );
  const [instituteId, setInstituteId] = useState<string>(DEMO_INSTITUTE.id);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const workspaceOk = await workspaceLogin({
      userId: rollNumber,
      role: "student",
      password: "student-session",
      instituteId,
    });
    if (!workspaceOk) {
      setError("Enter a valid institute ID.");
      return;
    }

    const matched = getRepositories().students.getByRollNumber(rollNumber);
    if (!matched) {
      await workspaceLogout();
      setError("No active student record was found for this roll number.");
      return;
    }

    if (!matched.active) {
      await workspaceLogout();
      setError("This student account is inactive. Contact the institute office.");
      return;
    }

    login({
      name: matched.fullName,
      rollNumber,
      applicationNumber,
      studentId: matched.id,
      batchId: matched.batchId,
      courseType: matched.courseType,
    });
    router.push("/student/tests");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_100%)] p-4">
      <Card className="w-full max-w-md border-[#d8d2c7] bg-white shadow-[0_18px_40px_rgba(20,33,61,0.08)]">
        <CardHeader className="space-y-2 border-b border-[#ece6da] bg-[#fbf9f4]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6f3e]">
            Student Login
          </p>
          <CardTitle className="text-2xl text-[#14213d]">{DEMO_INSTITUTE.name}</CardTitle>
          <CardDescription className="text-[#5e5a52]">
            Open your upcoming CBTs, resume attempts, and review your performance quickly.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="roll">Roll Number</Label>
              <Input
                id="roll"
                value={rollNumber}
                onChange={(event) => setRollNumber(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app">Application Number</Label>
              <Input
                id="app"
                value={applicationNumber}
                onChange={(event) => setApplicationNumber(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant">Institute ID</Label>
              <Input
                id="tenant"
                value={instituteId}
                onChange={(event) => setInstituteId(event.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" className="w-full bg-[#14213d] hover:bg-[#0f1a31]">
              Enter student workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
