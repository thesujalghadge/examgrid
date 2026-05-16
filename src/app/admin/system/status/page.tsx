"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SupabaseStatusReport } from "@/lib/supabase/check-connection";
import { cn } from "@/lib/utils";

export default function AdminSystemStatusPage() {
  const [report, setReport] = useState<SupabaseStatusReport | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/supabase-status", {
        cache: "no-store",
      });
      const data = (await res.json()) as SupabaseStatusReport;
      setReport(data);
    } catch {
      setReport({
        configured: false,
        urlLoaded: false,
        anonKeyLoaded: false,
        connection: "connection_failed",
        message: "Failed to run status check API.",
        checkedAt: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Status</h1>
          <p className="text-sm text-gray-600">
            Connectivity and environment checks before backend migration.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()} disabled={loading}>
          {loading ? "Checking…" : "Re-check"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Repository mode</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusRow label="Data persistence" value="localStorage mode" ok />
          <p className="mt-2 text-xs text-gray-500">
            Question bank, exam catalog, and student attempts use browser
            localStorage. Supabase migration is not active yet.
          </p>
        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supabase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow
              label="NEXT_PUBLIC_SUPABASE_URL"
              value={report.urlLoaded ? "Loaded" : "Missing"}
              ok={report.urlLoaded}
            />
            <StatusRow
              label="NEXT_PUBLIC_SUPABASE_ANON_KEY"
              value={report.anonKeyLoaded ? "Loaded" : "Missing"}
              ok={report.anonKeyLoaded}
            />
            <StatusRow
              label="Connection"
              value={report.connection.replace(/_/g, " ")}
              ok={report.connection === "connected"}
            />
            <p className="rounded bg-gray-50 p-3 text-sm text-gray-700">
              {report.message}
            </p>
            <p className="text-xs text-gray-400">
              Last checked: {new Date(report.checkedAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusRow({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 py-2 text-sm last:border-0">
      <span className="text-gray-600">{label}</span>
      <span
        className={cn(
          "font-medium capitalize",
          ok ? "text-green-700" : "text-amber-700",
        )}
      >
        {value}
      </span>
    </div>
  );
}
