"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function PlatformLoginPage() {
  const router = useRouter();
  const login = useWorkspaceAuthStore((s) => s.login);
  const [userId, setUserId] = useState<string>("ops@examgrid.local");
  const [password, setPassword] = useState<string>("1234");
  const [error, setError] = useState<string>("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_100%)] p-4">
      <Card className="w-full max-w-md border-[#d8d2c7]">
        <CardHeader className="border-b border-[#ece6da] bg-[#fbf9f4]">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a6f3e]">
            Platform Admin
          </p>
          <CardTitle className="text-2xl text-[#14213d]">Operational console login</CardTitle>
          <CardDescription className="text-[#5e5a52]">
            Use this access for institute management, onboarding support, and system monitoring.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void (async () => {
                const ok = await login({
                  role: "platform_admin",
                  userId,
                  password,
                });
                if (ok) router.push("/platform");
                else setError("Provide valid platform credentials.");
              })();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="user">User ID</Label>
              <Input
                id="user"
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
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" className="w-full bg-[#14213d] hover:bg-[#0f1a31]">
              Enter platform console
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
