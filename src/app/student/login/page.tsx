"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getActiveInstitutes } from "@/app/actions/institute-registry";
import { PlatformInstitute } from "@/types/platform-institute";
import { getRepositories } from "@/lib/repositories/provider";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function StudentLoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const workspaceLogin = useWorkspaceAuthStore((s) => s.login);
  const workspaceLogout = useWorkspaceAuthStore((s) => s.logout);
  const [rollNumber, setRollNumber] = useState("");
  const [applicationNumber, setApplicationNumber] = useState("");
  const [instituteId, setInstituteId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [institutes, setInstitutes] = useState<PlatformInstitute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getActiveInstitutes().then((data) => {
      setInstitutes(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (institutes.length > 0 && !instituteId) setInstituteId(institutes[0].id);
  }, [institutes, instituteId]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const roll = rollNumber.trim();
    if (!roll || !instituteId) {
      setError("Enter roll number and select institute.");
      return;
    }

    let workspaceOk = false;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: matchedStudent } = await supabase
        .from("students")
        .select("id")
        .eq("roll_number", roll)
        .eq("institute_id", instituteId)
        .maybeSingle();

      if (!matchedStudent) {
        setError("No active student found for this roll in the selected institute.");
        return;
      }

      workspaceOk = await workspaceLogin({
        userId: matchedStudent.id,
        role: "student",
        password: "dev",
        instituteId,
      });
    } catch (e: any) {
      if (e.message === "GHOST_INSTITUTE") {
        import("@/lib/platform-institute-registry").then((m) => {
          m.deletePlatformInstituteRemote(instituteId).catch(console.error);
        });
        setError("This institute no longer exists. Please refresh and select another.");
        return;
      }
      setError("An unexpected error occurred during login.");
      return;
    }

    if (!workspaceOk) {
      setError("Could not start session.");
      return;
    }

    const { hydrateSupabaseRepositories } = await import("@/lib/supabase/hydrate-repositories");
    await hydrateSupabaseRepositories();

    const matched = getRepositories().students.getByRollNumber(roll);
    if (!matched || matched.instituteId !== instituteId || !matched.active) {
      await workspaceLogout();
      setError("No active student found for this roll in the selected institute.");
      return;
    }

    login({
      name: matched.fullName,
      rollNumber: roll,
      applicationNumber: applicationNumber.trim() || roll,
      studentId: matched.id,
      batchId: matched.batchId,
      courseType: matched.courseType,
    });
    router.push("/student/tests");
  };



  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--eg-surface-soft)] p-4">
      <Card className="w-full max-w-md rounded-[32px] border-[1px] border-[rgba(0,0,0,0.06)] bg-white shadow-[var(--eg-shadow-rest)]">
        <CardHeader className="rounded-t-[32px] border-b border-[var(--eg-border)] bg-[#fafbfa] px-8 pb-8 pt-8">
          <CardTitle className="text-[28px] font-bold tracking-tight text-[var(--eg-text-primary)]">Student access</CardTitle>
          <CardDescription className="mt-2 text-[14px] leading-relaxed text-[var(--eg-text-secondary)]">
            Use roll number from institute records. Password not required during workflow testing.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-8 pt-8 pb-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[13px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Institute</Label>
              <select
                className="w-full rounded-xl border border-[var(--eg-border)] px-4 py-3 text-[15px] outline-none focus:border-[var(--eg-accent)] focus:ring-1 focus:ring-[var(--eg-accent)]"
                value={instituteId}
                onChange={(e) => setInstituteId(e.target.value)}
                disabled={institutes.length === 0}
              >
                {institutes.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
              {loading ? (
                <p className="text-[13px] font-semibold text-[var(--eg-text-secondary)]">
                  Loading institutes...
                </p>
              ) : institutes.length === 0 ? (
                <p className="text-[13px] font-semibold text-[var(--eg-danger)]">
                  No institutes registered. Wait for admin configuration.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll" className="text-[13px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Roll number</Label>
              <Input 
                id="roll" 
                value={rollNumber} 
                onChange={(e) => setRollNumber(e.target.value)} 
                required 
                className="rounded-xl border-[var(--eg-border)] px-4 py-6 text-[15px] focus-visible:ring-[var(--eg-accent)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="app" className="text-[13px] font-bold uppercase tracking-wider text-[var(--eg-text-tertiary)]">Application number (optional)</Label>
              <Input 
                id="app" 
                value={applicationNumber} 
                onChange={(e) => setApplicationNumber(e.target.value)} 
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
                Enter Student Portal
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
