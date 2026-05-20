"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getLocalTestAnalytics } from "@/lib/cbt/client-test-analytics";
import { getRepositories } from "@/lib/repositories/provider";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";

export default function InstituteAnalyticsPage() {
  const hydrate = useWorkspaceAuthStore((s) => s.hydrate);
  const instituteId = useWorkspaceAuthStore((s) => s.session?.instituteId);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const tests = useMemo(() => {
    if (!instituteId) return [];
    return getRepositories().cbtTests.list();
  }, [instituteId, hydrate]);

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Institute Analytics</h1>
        <p className="text-sm text-gray-600">
          Per-test completion, averages, and cohort insights for your tenant.
        </p>
      </div>

      {tests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-gray-500">
            No CBT tests yet. Create a test under Tests to see analytics.
          </CardContent>
        </Card>
      ) : (
        tests.map((t) => {
          const stats = instituteId
            ? getLocalTestAnalytics(t.id, instituteId)
            : null;
          return (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="text-base">{t.title}</CardTitle>
                <CardDescription>
                  {stats
                    ? `${stats.attemptCount} submissions · avg ${stats.averageScore.toFixed(1)} · completion ${(stats.completionRate * 100).toFixed(0)}%`
                    : "No data"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Link
                  href={`/institute/tests/${t.id}`}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Test detail
                </Link>
                <a
                  href={`/api/institute/analytics/test/${t.id}`}
                  className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
                  target="_blank"
                  rel="noreferrer"
                >
                  API JSON
                </a>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
