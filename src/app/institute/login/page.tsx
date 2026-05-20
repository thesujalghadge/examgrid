"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function InstituteLoginPage() {
  const router = useRouter();
  const session = useWorkspaceAuthStore((s) => s.session);
  const hydrateSession = useWorkspaceAuthStore((s) => s.hydrateSession);
  const login = useWorkspaceAuthStore((s) => s.login);
  const [userId, setUserId] = useState("admin@apexjee.ac.in");
  const [password, setPassword] = useState("1234");
  const [instituteId, setInstituteId] = useState("inst-apex-jee");
  const [error, setError] = useState("");

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (session && session.role !== "super_admin") {
      router.replace("/institute/dashboard");
    }
  }, [router, session]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Institute Workspace Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                const ok = await login({
                  role: "institute_admin",
                  userId,
                  password,
                  instituteId,
                });
                if (ok) router.push("/institute/dashboard");
                else setError("Provide valid credentials and institute id.");
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
              <Label htmlFor="tenant">Institute Tenant ID</Label>
              <Input
                id="tenant"
                value={instituteId}
                onChange={(event) => setInstituteId(event.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full bg-[#1a3c6e]">
              Enter Institute Workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
