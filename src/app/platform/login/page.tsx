"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
    <div className="flex min-h-screen items-center justify-center bg-[var(--eg-surface-soft)] p-4">
      <Card className="w-full max-w-md rounded-[32px] border-[1px] border-[rgba(0,0,0,0.06)] bg-white shadow-[var(--eg-shadow-rest)]">
        <CardHeader className="rounded-t-[32px] border-b border-[var(--eg-border)] bg-[#fafbfa] px-8 pb-8 pt-8">
          <CardTitle className="text-[28px] font-bold tracking-tight text-[var(--eg-text-primary)]">Platform console</CardTitle>
          <CardDescription className="mt-2 text-[14px] leading-relaxed text-[var(--eg-text-secondary)]">
            Internal workflow access — password checks disabled for testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pt-8 pb-8">
          <form
            className="space-y-5"
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
              <Label htmlFor="user" className="text-[13px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Operator ID</Label>
              <Input 
                id="user" 
                value={userId} 
                onChange={(e) => setUserId(e.target.value)} 
                className="rounded-xl border-[var(--eg-border)] px-4 py-6 text-[15px] focus-visible:ring-[var(--eg-accent)]"
              />
            </div>
            {error ? <p className="text-[13px] font-semibold text-[var(--eg-danger)]">{error}</p> : null}
            <div className="pt-2">
              <button 
                type="submit" 
                className="w-full inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[var(--eg-accent)] px-4 text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(81,71,232,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--eg-accent-strong)] hover:shadow-[0_18px_38px_rgba(81,71,232,0.30)]" 
              >
                Enter Platform
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
