"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getPlatformInstitute,
  listPlatformInstitutes,
} from "@/lib/platform-institute-registry";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function InstituteLoginPage() {
  const router = useRouter();
  const session = useWorkspaceAuthStore((s) => s.session);
  const hydrateSession = useWorkspaceAuthStore((s) => s.hydrateSession);
  const login = useWorkspaceAuthStore((s) => s.login);
  const [userId, setUserId] = useState("institute-admin");
  const [instituteId, setInstituteId] = useState("");
  const [error, setError] = useState("");

  const institutes = useMemo(() => listPlatformInstitutes(), []);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  useEffect(() => {
    if (institutes.length > 0 && !instituteId) {
      setInstituteId(institutes[0].id);
    }
  }, [institutes, instituteId]);

  useEffect(() => {
    if (session?.role === "institute") router.replace("/institute");
  }, [router, session]);

  const selected = getPlatformInstitute(instituteId);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f5f1e8_0%,#fbf9f4_100%)] p-4">
      <Card className="w-full max-w-md border-[#d8d2c7]">
        <CardHeader className="border-b border-[#ece6da] bg-[#fbf9f4]">
          <CardTitle className="text-2xl text-[#14213d]">Institute workspace</CardTitle>
          <CardDescription className="text-[#5e5a52]">
            Select your institute and continue. Add institutes from platform admin first.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!instituteId) {
                setError("Create an institute in platform admin, then select it here.");
                return;
              }
              if (selected?.status === "inactive") {
                setError("This institute is deactivated.");
                return;
              }
              void (async () => {
                try {
                  const ok = await login({
                    role: "institute",
                    userId: userId.trim() || selected?.adminEmail || "institute-admin",
                    password: "dev",
                    instituteId,
                  });
                  if (ok) router.push("/institute");
                  else setError("Could not start session.");
                } catch (e: any) {
                  if (e.message === "GHOST_INSTITUTE") {
                    import("@/lib/platform-institute-registry").then((m) => {
                      m.deletePlatformInstitute(instituteId);
                    });
                    setError("This institute no longer exists. Please refresh and select another.");
                  } else {
                    setError("An unexpected error occurred.");
                  }
                }
              })();
            }}
          >
            <div className="space-y-2">
              <Label>Institute</Label>
              {institutes.length === 0 ? (
                <p className="text-sm text-amber-800">
                  No institutes registered. Log in as platform admin and add one.
                </p>
              ) : (
                <select
                  className="w-full rounded-md border border-[#ece6da] px-3 py-2 text-sm"
                  value={instituteId}
                  onChange={(e) => setInstituteId(e.target.value)}
                >
                  {institutes.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.status})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="user">Staff ID</Label>
              <Input id="user" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
            {error ? <p className="text-sm text-red-700">{error}</p> : null}
            <Button type="submit" className="w-full bg-[#14213d]" disabled={institutes.length === 0}>
              Enter institute
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
