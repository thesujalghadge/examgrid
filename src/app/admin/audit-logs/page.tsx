"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listAuditLogs } from "@/services/audit-service";
import type { AuditLogEntry, AuditLogPage } from "@/types/audit";

const ACTIONS = [
  "",
  "admin_login",
  "student_login",
  "exam_create",
  "exam_delete",
  "schedule_create",
  "schedule_edit",
  "student_import",
  "batch_create",
  "batch_archive",
  "exam_start",
  "exam_submit",
  "fullscreen_violation",
  "tab_switch_violation",
  "session_expired",
];

export default function AuditLogsPage() {
  const [page, setPage] = useState<AuditLogPage>({
    rows: [],
    total: 0,
    page: 1,
    pageSize: 25,
  });
  const [filters, setFilters] = useState({
    search: "",
    actorId: "",
    actionType: "",
    startUTC: "",
    endUTC: "",
  });
  const [loading, setLoading] = useState(false);

  const load = async (nextPage = 1) => {
    setLoading(true);
    try {
      const result = await listAuditLogs({
        ...filters,
        startUTC: filters.startUTC
          ? new Date(filters.startUTC).toISOString()
          : undefined,
        endUTC: filters.endUTC ? new Date(filters.endUTC).toISOString() : undefined,
        page: nextPage,
        pageSize: 25,
      });
      setPage(result);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(1), 0);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalPages = Math.max(1, Math.ceil(page.total / page.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-600">
          Trace administrative actions, student sessions, and CBT integrity events.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-5">
            <Field label="Search">
              <Input
                value={filters.search}
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
              />
            </Field>
            <Field label="Actor">
              <Input
                value={filters.actorId}
                onChange={(e) =>
                  setFilters({ ...filters, actorId: e.target.value })
                }
              />
            </Field>
            <Field label="Action">
              <select
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                value={filters.actionType}
                onChange={(e) =>
                  setFilters({ ...filters, actionType: e.target.value })
                }
              >
                {ACTIONS.map((action) => (
                  <option key={action || "all"} value={action}>
                    {action || "All actions"}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start">
              <Input
                type="datetime-local"
                value={filters.startUTC}
                onChange={(e) =>
                  setFilters({ ...filters, startUTC: e.target.value })
                }
              />
            </Field>
            <Field label="End">
              <Input
                type="datetime-local"
                value={filters.endUTC}
                onChange={(e) =>
                  setFilters({ ...filters, endUTC: e.target.value })
                }
              />
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void load(1)} disabled={loading}>
              Apply
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFilters({
                  search: "",
                  actorId: "",
                  actionType: "",
                  startUTC: "",
                  endUTC: "",
                });
                void load(1);
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Resource</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {page.rows.map((entry) => (
              <AuditRow key={entry.eventId} entry={entry} />
            ))}
            {page.rows.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-gray-500" colSpan={6}>
                  No audit events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Page {page.page} of {totalPages} · {page.total} event(s)
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={page.page <= 1 || loading}
            onClick={() => void load(page.page - 1)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={page.page >= totalPages || loading}
            onClick={() => void load(page.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      {children}
    </div>
  );
}

function AuditRow({ entry }: { entry: AuditLogEntry }) {
  return (
    <tr>
      <td className="px-4 py-3 text-xs">
        {new Date(entry.timestampUTC).toLocaleString("en-IN", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
      </td>
      <td className="px-4 py-3">
        <p className="font-medium">{entry.actorId}</p>
        <p className="text-xs text-gray-500">{entry.actorRole}</p>
      </td>
      <td className="px-4 py-3">{entry.actionType}</td>
      <td className="px-4 py-3 text-xs">
        <p>{entry.resourceType}</p>
        <p className="text-gray-500">{entry.resourceId}</p>
      </td>
      <td className="px-4 py-3">{entry.outcome}</td>
      <td className="max-w-xs truncate px-4 py-3 font-mono text-xs text-gray-600">
        {JSON.stringify(entry.metadata)}
      </td>
    </tr>
  );
}
