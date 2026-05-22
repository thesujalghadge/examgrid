"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_INSTITUTE } from "@/config/demo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function InstituteLoginPage() {
  const router = useRouter();
  const session = useWorkspaceAuthStore((s) => s.session);
  const hydrateSession = useWorkspaceAuthStore((s) => s.hydrateSession);
  const login = useWorkspaceAuthStore((s) => s.login);
  const [userId, setUserId] = useState<string>("admin@apexjee.ac.in");
  const [password, setPassword] = useState<string>("1234");
  const [instituteId, setInstituteId] = useState<string>(DEMO_INSTITUTE.id);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (session?.role === "institute") {
      router.replace("/institute");
    }
  }, [router, session]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_100%)] p-4">
      <Card className="w-full max-w-md border-[#d8d2c7]">
        <CardHeader className="border-b border-[#ece6da] bg-[#fbf9f4]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6f3e]">
            Institute Login
          </p>
          <CardTitle className="text-2xl text-[#14213d]">{DEMO_INSTITUTE.name}</CardTitle>
          <CardDescription className="text-[#5e5a52]">
            Manage students, batches, tests, and reports from one operational workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                const ok = await login({
                  role: "institute",
                  userId,
                  password,
                  instituteId,
                });
                if (ok) router.push("/institute");
                else setError("Provide valid credentials and institute ID.");
              })();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="email">User ID</Label>
              <Input
                id="email"
                type="email"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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
              Enter institute workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
