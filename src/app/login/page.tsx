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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#eef3f8] to-gray-200 p-4">
      <Card className="w-full max-w-md border-[#1a3c6e]/20 shadow-lg">
        <CardHeader className="border-b bg-[#1a3c6e] text-white">
          <CardTitle className="text-lg">{DEMO_INSTITUTE.name}</CardTitle>
          <CardDescription className="text-blue-100">
            ExamGrid CBT Portal · Demo Institute
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Candidate Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll">Roll Number</Label>
              <Input
                id="roll"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app">Application Number</Label>
              <Input
                id="app"
                value={applicationNumber}
                onChange={(e) => setApplicationNumber(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full bg-[#1a3c6e] hover:bg-[#152d52]">
              Login to Examination System
            </Button>
            {error && <p className="text-sm text-red-700">{error}</p>}
          </form>
          <p className="mt-4 text-center text-xs text-gray-500">
            Demo roll: {DEMO_LOGIN.studentRoll}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
