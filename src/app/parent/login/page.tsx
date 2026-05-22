"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_INSTITUTE } from "@/config/demo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useParentAccessStore } from "@/stores/parent-access-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { getRepositories } from "@/lib/repositories/provider";

export default function ParentLoginPage() {
  const router = useRouter();
  const login = useWorkspaceAuthStore((s) => s.login);
  const logout = useWorkspaceAuthStore((s) => s.logout);
  const linkStudent = useParentAccessStore((s) => s.linkStudent);
  const [rollNumber, setRollNumber] = useState<string>("APX-JEE-26001");
  const [phone, setPhone] = useState<string>("9876501001");
  const [instituteId, setInstituteId] = useState<string>(DEMO_INSTITUTE.id);
  const [error, setError] = useState<string>("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_100%)] p-4">
      <Card className="w-full max-w-md border-[#d8d2c7]">
        <CardHeader className="border-b border-[#ece6da] bg-[#fbf9f4]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6f3e]">
            Parent Login
          </p>
          <CardTitle className="text-2xl text-[#14213d]">Progress visibility access</CardTitle>
          <CardDescription className="text-[#5e5a52]">
            Review attendance, performance, and weak-topic summaries without academic overload.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                setError("");
                const ok = await login({
                  role: "parent",
                  userId: `parent:${rollNumber}`,
                  password: "parent-session",
                  instituteId,
                });
                if (!ok) {
                  setError("Provide a valid institute ID.");
                  return;
                }

                const student = getRepositories().students.getByRollNumber(rollNumber);
                const phoneMatches = student?.phone === phone || student?.phone?.endsWith(phone);
                if (!student || !phoneMatches) {
                  await logout();
                  setError("We could not verify this student and contact number.");
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
              <Label htmlFor="roll">Student Roll Number</Label>
              <Input id="roll" value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Registered Phone</Label>
              <Input id="phone" value={phone} onChange={(event) => setPhone(event.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant">Institute ID</Label>
              <Input id="tenant" value={instituteId} onChange={(event) => setInstituteId(event.target.value)} required />
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" className="w-full bg-[#14213d] hover:bg-[#0f1a31]">
              Open parent view
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
