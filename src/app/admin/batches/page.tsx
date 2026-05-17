"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { getRepositories } from "@/lib/repositories/provider";
import { recordAuditEvent } from "@/services/audit-service";
import { createBatchInput } from "@/services/institute-ops-service";
import type { Batch } from "@/types/institute-ops";

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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Batch Management</h1>
        <p className="text-sm text-gray-600">
          {activeCount} active batches, {batches.length} total.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Edit Batch" : "Create Batch"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-5">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Batch name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="JEE 2026 A"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course">Course</Label>
              <Input
                id="course"
                value={form.courseType}
                onChange={(e) =>
                  setForm({ ...form, courseType: e.target.value })
                }
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
                required
              />
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                Active
              </label>
              <Button type="submit">{editingId ? "Update" : "Create"}</Button>
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
                <td className="px-4 py-3">
                  {batch.active ? "Active" : "Archived"}
                </td>
                <td className="space-x-2 px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => edit(batch)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => archive(batch.id)}
                    disabled={!batch.active}
                  >
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
