"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPlatformInstitutes } from "@/lib/platform-institute-registry";
import { getRepositories } from "@/lib/repositories/provider";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function StudentLoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const workspaceLogin = useWorkspaceAuthStore((s) => s.login);
  const workspaceLogout = useWorkspaceAuthStore((s) => s.logout);
  const [rollNumber, setRollNumber] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const institutes = useMemo(
    () => listPlatformInstitutes().filter((institute) => institute.status === "active"),
    [],
  );

  useEffect(() => {
    if (institutes.length > 0 && !instituteId) setInstituteId(institutes[0].id);
  }, [institutes, instituteId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const roll = rollNumber.trim();
    if (!roll || !instituteId) {
      setError("Enter roll number and select institute.");
      return;
    }

    const workspaceOk = await workspaceLogin({
      userId: roll,
      role: "student",
      password: "dev",
      instituteId,
    });
    if (!workspaceOk) {
      setError("Could not start session.");
      return;
    }

    const matched = getRepositories().students.getByRollNumber(roll);
    if (!matched || matched.instituteId !== instituteId || !matched.active) {
      await workspaceLogout();
      setError("No active student found for this roll in the selected institute.");
      return;
    }

    login({
      name: matched.fullName,
      rollNumber: roll,
      applicationNumber: applicationNumber.trim() || roll,
      studentId: matched.id,
      batchId: matched.batchId,
      courseType: matched.courseType,
    });
    router.push("/student/tests");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_100%)] p-4">
      <Card className="w-full max-w-md border-[#d8d2c7] bg-white">
        <CardHeader className="border-b border-[#ece6da] bg-[#fbf9f4]">
          <CardTitle className="text-2xl text-[#14213d]">Student access</CardTitle>
          <CardDescription className="text-[#5e5a52]">
            Use roll number from institute records. Password not required during workflow testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Institute</Label>
              <select
                className="w-full rounded-md border border-[#ece6da] px-3 py-2 text-sm"
                value={instituteId}
                onChange={(e) => setInstituteId(e.target.value)}
                disabled={institutes.length === 0}
              >
                {institutes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              {institutes.length === 0 ? (
                <p className="text-sm text-amber-800">
                  No active institute is available for student login.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll">Roll number</Label>
              <Input id="roll" value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app">Application number (optional)</Label>
              <Input id="app" value={applicationNumber} onChange={(e) => setApplicationNumber(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" className="w-full bg-[#14213d]" disabled={institutes.length === 0}>
              Enter tests
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
