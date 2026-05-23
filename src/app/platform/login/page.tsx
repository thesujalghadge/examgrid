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
  const [userId, setUserId] = useState("platform-admin");
  const [error, setError] = useState("");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_100%)] p-4">
      <Card className="w-full max-w-md border-[#d8d2c7]">
        <CardHeader className="border-b border-[#ece6da] bg-[#fbf9f4]">
          <CardTitle className="text-2xl text-[#14213d]">Platform console</CardTitle>
          <CardDescription className="text-[#5e5a52]">
            Internal workflow access — password checks disabled for testing.
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
                  userId: userId.trim() || "platform-admin",
                  password: "dev",
                });
                if (ok) router.push("/platform");
                else setError("Could not start session.");
              })();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="user">Operator ID</Label>
              <Input id="user" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" className="w-full bg-[#14213d]">
              Enter platform
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
