"use client";

import { type ReactNode, useMemo, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { getRepositories } from "@/lib/repositories/provider";
import { scopeByInstituteId, withInstituteId } from "@/lib/tenant-scope";
import { recordAuditEvent } from "@/services/audit-service";
import { createBatchInput } from "@/services/institute-ops-service";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { Batch } from "@/types/institute-ops";
import Link from "next/link";

const blank = {
  name: "",
  courseType: "JEE",
  academicYear: "2026",
  active: true,
};

export default function InstituteBatchesPage() {
  const repos = getRepositories();
  const tenantId = useWorkspaceAuthStore((s) => s.session?.instituteId ?? null);
  const [batches, setBatches] = useState<Batch[]>(() =>
    tenantId ? scopeByInstituteId(repos.batches.list(), tenantId) : repos.batches.list(),
  );
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const activeCount = useMemo(() => batches.filter((batch) => batch.active).length, [batches]);

  const refresh = async () => {
    const maybeRemote = repos.batches as typeof repos.batches & {
      refreshFromRemote?: () => Promise<void>;
    };
    await maybeRemote.refreshFromRemote?.();
    setBatches(
      tenantId ? scopeByInstituteId(repos.batches.list(), tenantId) : repos.batches.list(),
    );
  };

  useEffect(() => {
    void refresh();
  }, [repos, tenantId]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!tenantId) {
      alert("Session not loaded. Please refresh the page and try again.");
      return;
    }
    setSaving(true);
    try {
      const currentTenantId = tenantId;
      const duplicate = batches.find(
        (batch) =>
          batch.id !== editingId &&
          batch.instituteId === currentTenantId &&
          batch.name.trim().toLowerCase() === form.name.trim().toLowerCase() &&
          batch.academicYear.trim() === form.academicYear.trim(),
      );
      if (duplicate) {
        alert("A batch with this name and academic year already exists. Update that batch instead.");
        return;
      }

      const existing = editingId ? repos.batches.getById(editingId) : undefined;
      repos.batches.save(withInstituteId({
        ...(existing ?? createBatchInput(form)),
        name: form.name,
        courseType: form.courseType,
        academicYear: form.academicYear,
        active: form.active,
        updatedAt: Date.now(),
      }, currentTenantId));
      recordAuditEvent({
        actorRole: "admin",
        actionType: existing ? "batch_edit" : "batch_create",
        resourceType: "batch",
        resourceId: existing?.id ?? form.name,
        metadata: { name: form.name, courseType: form.courseType },
      });
      await awaitRepositoryPersist();
      setForm(blank);
      setEditingId(null);
      void refresh();
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? error.code : null;
      if (code === "23505") {
        alert("A batch with this name and academic year already exists.");
      } else {
        alert(error instanceof Error ? error.message : "Failed to save batch.");
      }
    } finally {
      setSaving(false);
    }
  };

  const edit = (batch: Batch) => {
    setEditingId(batch.id);
    setForm({
      name: batch.name,
      courseType: batch.courseType,
      academicYear: batch.academicYear,
      active: batch.active,
    });
  };

  const archive = async (id: string) => {
    const activeSchedule = repos.schedules
      .list()
      .find((schedule) => schedule.active && schedule.batchIds.includes(id));
    if (activeSchedule) {
      recordAuditEvent({
        actorRole: "admin",
        actionType: "operation_blocked",
        resourceType: "batch",
        resourceId: id,
        metadata: { reason: "active_schedule", scheduleId: activeSchedule.id },
        outcome: "blocked",
      });
      alert("Cannot archive a batch with an active schedule.");
      return;
    }
    if (!confirm("Archive this batch? Students remain assigned but the batch becomes inactive.")) {
      return;
    }
    repos.batches.archive(id);
    recordAuditEvent({
      actorRole: "admin",
      actionType: "batch_archive",
      resourceType: "batch",
      resourceId: id,
    });
    await awaitRepositoryPersist();
    void refresh();
  };

  if (!tenantId) {
    return <div className="p-8 text-sm text-gray-500">Loading session...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Batch Management</h1>
        <p className="text-sm text-gray-600">
          {activeCount} active batches, {batches.length} total.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Edit Batch" : "Create Batch"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-5">
            <Field label="Batch name" id="name">
              <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="JEE 2026 A" required />
            </Field>
            <Field label="Course" id="course">
              <select
                id="course"
                value={form.courseType}
                onChange={(e) => setForm({ ...form, courseType: e.target.value })}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
                <option value="CET-M">CET-M</option>
                <option value="CET-B">CET-B</option>
              </select>
            </Field>
            <Field label="Academic year" id="year">
              <Input id="year" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} required />
            </Field>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active
              </label>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Course</th>
              <th className="px-4 py-3">Year</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {batches.map((batch) => (
              <tr key={batch.id}>
                <td className="px-4 py-3 font-medium">{batch.name}</td>
                <td className="px-4 py-3">{batch.courseType}</td>
                <td className="px-4 py-3">{batch.academicYear}</td>
                <td className="px-4 py-3">{batch.active ? "Active" : "Archived"}</td>
                <td className="space-x-2 px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => edit(batch)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" render={<Link href={`/institute/batches/${batch.id}/syllabus`} />} nativeButton={false}>
                    Syllabus
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => archive(batch.id)} disabled={!batch.active}>
                    Archive
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 md:col-span-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
