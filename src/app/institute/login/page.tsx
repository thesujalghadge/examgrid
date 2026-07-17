"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActiveInstitutes } from "@/app/actions/institute-registry";
import { PlatformInstitute } from "@/types/platform-institute";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function InstituteLoginPage() {
  const router = useRouter();
  const session = useWorkspaceAuthStore((s) => s.session);
  const hydrateSession = useWorkspaceAuthStore((s) => s.hydrateSession);
  const login = useWorkspaceAuthStore((s) => s.login);
  const [userId, setUserId] = useState("institute-admin");
  const [instituteId, setInstituteId] = useState("");
  const [error, setError] = useState("");

  const [institutes, setInstitutes] = useState<PlatformInstitute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveInstitutes().then((data) => {
      setInstitutes(data);
      setLoading(false);
    });
  }, []);

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

  const selected = institutes.find((i) => i.id === instituteId);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--eg-surface-soft)] p-4">
      <Card className="w-full max-w-md rounded-[32px] border-[1px] border-[rgba(0,0,0,0.06)] bg-white shadow-[var(--eg-shadow-rest)]">
        <CardHeader className="rounded-t-[32px] border-b border-[var(--eg-border)] bg-[#fafbfa] px-8 pb-8 pt-8">
          <CardTitle className="text-[28px] font-bold tracking-tight text-[var(--eg-text-primary)]">Institute workspace</CardTitle>
          <CardDescription className="mt-2 text-[14px] leading-relaxed text-[var(--eg-text-secondary)]">
            Select your institute and continue. Add institutes from platform admin first.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pt-8 pb-8">
          <form
            className="space-y-5"
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
                      m.deletePlatformInstituteRemote(instituteId).catch(console.error);
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
              <Label className="text-[13px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Institute</Label>
              {loading ? (
                <p className="text-[13px] font-semibold text-[var(--eg-text-secondary)]">
                  Loading institutes...
                </p>
              ) : institutes.length === 0 ? (
                <p className="text-[13px] font-semibold text-[var(--eg-danger)]">
                  No active institutes found. Please run Demo Factory or contact platform admin.
                </p>
              ) : (
                <select
                  className="w-full rounded-xl border border-[var(--eg-border)] px-4 py-3 text-[15px] outline-none focus:border-[var(--eg-accent)] focus:ring-1 focus:ring-[var(--eg-accent)]"
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
              <Label htmlFor="user" className="text-[13px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Staff ID</Label>
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
                className="w-full inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[var(--eg-accent)] px-4 text-[15px] font-semibold text-white shadow-[0_14px_30px_rgba(81,71,232,0.24)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--eg-accent-strong)] hover:shadow-[0_18px_38px_rgba(81,71,232,0.30)] disabled:opacity-50 disabled:pointer-events-none" 
                disabled={institutes.length === 0}
              >
                Enter Institute
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
