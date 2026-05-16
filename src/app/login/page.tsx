"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [name, setName] = useState("Rahul Sharma");
  const [rollNumber, setRollNumber] = useState("NTA2026001234");
  const [applicationNumber, setApplicationNumber] = useState("APP-JEE-2026-001");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ name, rollNumber, applicationNumber });
    router.push("/exams");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[#e8eef5] to-gray-200 p-4">
      <Card className="w-full max-w-md border-[#1a3c6e]/20 shadow-lg">
        <CardHeader className="border-b bg-[#1a3c6e] text-white">
          <CardTitle className="text-lg">National Testing Agency</CardTitle>
          <CardDescription className="text-blue-100">
            ExamGrid — Candidate Login (Mock)
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
          </form>
          <p className="mt-4 text-center text-xs text-gray-500">
            Demo mode — any valid form submission proceeds.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
