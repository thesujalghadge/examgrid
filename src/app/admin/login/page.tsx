"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DEMO_INSTITUTE } from "@/config/demo";
import { DEMO_LOGIN } from "@/data/demo-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductMark } from "@/components/shared/product-ui";
import { useAdminAuthStore } from "@/stores/admin-auth-store";

export default function AdminLoginPage() {
  const router = useRouter();
  const admin = useAdminAuthStore((s) => s.admin);
  const hydrate = useAdminAuthStore((s) => s.hydrate);
  const login = useAdminAuthStore((s) => s.login);
  const [email, setEmail] = useState<string>(DEMO_LOGIN.adminEmail);
  const [password, setPassword] = useState<string>(DEMO_LOGIN.adminPassword);
  const [error, setError] = useState("");

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (admin) router.replace("/admin");
  }, [admin, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login(email, password)) {
      router.push("/admin");
    } else {
      setError("Invalid credentials (password min 4 characters).");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--eg-canvas)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <ProductMark subtitle="Operations console" />
        </div>
        <div className="eg-card overflow-hidden">
          <div className="border-b border-[var(--eg-border)] bg-[var(--eg-brand)] px-6 py-5 text-white">
            <p className="eg-section-title text-blue-200/80">Institute admin</p>
            <h1 className="mt-1 text-xl font-semibold">{DEMO_INSTITUTE.name}</h1>
            <p className="mt-1 text-sm text-blue-100/90">
              Secure access to scheduling, roster, and audit tools.
            </p>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                type="submit"
                className="h-10 w-full bg-[var(--eg-brand)] hover:bg-[var(--eg-brand-hover)]"
              >
                Sign in to console
              </Button>
            </form>
            <p className="mt-5 text-center text-xs text-slate-500">
              Demo: {DEMO_LOGIN.adminEmail} / {DEMO_LOGIN.adminPassword}
            </p>
            <p className="mt-3 text-center text-xs">
              <Link href="/" className="text-[var(--eg-brand)] hover:underline">
                ← Back to ExamGrid
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}


