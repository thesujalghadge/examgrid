"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { getRepositories } from "@/lib/repositories/provider";
import { recordAuditEvent } from "@/services/audit-service";
import { createBatchInput } from "@/services/institute-ops-service";
import type { Batch } from "@/types/institute-ops";
import { DashboardPanel, PageHeader, SectionHeader, StatusBadge } from "@/components/shared/product-ui";

const blank = {
  name: "",
  courseType: "JEE",
  academicYear: "2026",
  active: true,
};

export default function AdminBatchesPage() {
  const repos = getRepositories();
  const [batches, setBatches] = useState<Batch[]>(() => repos.batches.list());
  const [form, setForm] = useState(blank);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => batches.filter((batch) => batch.active).length,
    [batches],
  );

  const refresh = () => setBatches(repos.batches.list());

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const existing = editingId ? repos.batches.getById(editingId) : undefined;
    const now = Date.now();
    repos.batches.save({
      ...(existing ?? createBatchInput(form)),
      name: form.name,
      courseType: form.courseType,
      academicYear: form.academicYear,
      active: form.active,
      updatedAt: now,
    });
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
    refresh();
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
    refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch Management"
        description={`${activeCount} active batches, ${batches.length} total. Organize students into operational groups.`}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        {/* Roster Table */}
        <div className="space-y-4">
          <SectionHeader title="Active & Archived Batches" />
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/50 border-b border-border sticky top-0">
                  <tr>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium">Batch</th>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium">Course</th>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium">Year</th>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium">Status</th>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {batches.map((batch) => (
                    <tr key={batch.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-4 text-table font-medium text-foreground">{batch.name}</td>
                      <td className="px-5 py-4 text-table text-muted-foreground">{batch.courseType}</td>
                      <td className="px-5 py-4 text-table text-muted-foreground">{batch.academicYear}</td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={batch.active ? "green" : "neutral"}>
                          {batch.active ? "Active" : "Archived"}
                        </StatusBadge>
                      </td>
                      <td className="space-x-2 px-5 py-4 text-right">
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => edit(batch)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-amber-600 hover:bg-amber-100/50 hover:text-amber-700 dark:hover:bg-amber-900/30"
                          onClick={() => archive(batch.id)}
                          disabled={!batch.active}
                        >
                          Archive
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-muted-foreground">
                        No batches configured. Create your first batch to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-6">
          <DashboardPanel>
            <SectionHeader title={editingId ? "Edit Batch" : "Create Batch"} />
            <form onSubmit={save} className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Batch name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="JEE 2026 A"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="course">Course</Label>
                  <Input
                    id="course"
                    value={form.courseType}
                    onChange={(e) =>
                      setForm({ ...form, courseType: e.target.value })
                    }
                    placeholder="JEE"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Academic year</Label>
                  <Input
                    id="year"
                    value={form.academicYear}
                    onChange={(e) =>
                      setForm({ ...form, academicYear: e.target.value })
                    }
                    placeholder="2026"
                    required
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="rounded border-input text-primary focus:ring-primary"
                    checked={form.active}
                    onChange={(e) =>
                      setForm({ ...form, active: e.target.checked })
                    }
                  />
                  Active status
                </label>
                <Button type="submit">{editingId ? "Update Batch" : "Create Batch"}</Button>
              </div>
            </form>
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}
