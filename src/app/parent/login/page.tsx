"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listPlatformInstitutes } from "@/lib/platform-institute-registry";
import { useParentAccessStore } from "@/stores/parent-access-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { getRepositories } from "@/lib/repositories/provider";

export default function ParentLoginPage() {
  const router = useRouter();
  const login = useWorkspaceAuthStore((s) => s.login);
  const linkStudent = useParentAccessStore((s) => s.linkStudent);
  const [studentRoll, setStudentRoll] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [error, setError] = useState("");

  const institutes = listPlatformInstitutes();

  useEffect(() => {
    if (institutes.length > 0 && !instituteId) setInstituteId(institutes[0].id);
  }, [institutes, instituteId]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_100%)] p-4">
      <Card className="w-full max-w-md border-[#d8d2c7]">
        <CardHeader className="border-b border-[#ece6da] bg-[#fbf9f4]">
          <CardTitle className="text-2xl text-[#14213d]">Parent access</CardTitle>
          <CardDescription className="text-[#5e5a52]">
            Enter your ward&apos;s roll number to view attendance and test progress.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setError("");
                const roll = studentRoll.trim();
                if (!roll || !instituteId) {
                  setError("Enter student roll and institute.");
                  return;
                }
                const student = getRepositories().students.getByRollNumber(roll);
                if (!student || student.instituteId !== instituteId) {
                  setError("Student not found in this institute.");
                  return;
                }
                const ok = await login({
                  role: "parent",
                  userId: `parent:${roll}`,
                  password: "dev",
                  instituteId,
                });
                if (!ok) {
                  setError("Could not start session.");
                  return;
                }
                linkStudent({
                  fullName: student.fullName,
                  rollNumber: student.rollNumber,
                  batchId: student.batchId,
                  courseType: student.courseType,
                });
                router.push("/parent");
              })();
            }}
          >
            <div className="space-y-2">
              <Label>Institute</Label>
              <select
                className="w-full rounded-md border border-[#ece6da] px-3 py-2 text-sm"
                value={instituteId}
                onChange={(e) => setInstituteId(e.target.value)}
              >
                {institutes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll">Student roll number</Label>
              <Input id="roll" value={studentRoll} onChange={(e) => setStudentRoll(e.target.value)} required />
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" className="w-full bg-[#14213d]">
              Open parent view
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
