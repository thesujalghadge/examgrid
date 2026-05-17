"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_INSTITUTE } from "@/config/demo";
import { DEMO_LOGIN } from "@/data/demo-data";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{DEMO_INSTITUTE.name} Admin</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full bg-[#1a3c6e]">
              Login
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-gray-500">
            Demo admin: {DEMO_LOGIN.adminEmail} / {DEMO_LOGIN.adminPassword}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
