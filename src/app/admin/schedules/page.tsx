"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { getRepositories } from "@/lib/repositories/provider";
import { recordAuditEvent } from "@/services/audit-service";
import {
  createScheduleInput,
  getScheduleStatus,
} from "@/services/institute-ops-service";
import type { ExamDefinition } from "@/types/exam";
import type { Batch, ExamSchedule } from "@/types/institute-ops";

function toLocalInputValue(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

const now = new Date();
const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
const defaultEnd = new Date(now.getTime() + 4 * 60 * 60 * 1000);

const blank = {
  examId: "",
  batchIds: [] as string[],
  startAt: toLocalInputValue(defaultStart.toISOString()),
  endAt: toLocalInputValue(defaultEnd.toISOString()),
  durationMinutes: 180,
  visibilityRule: "assigned_batches" as ExamSchedule["visibilityRule"],
  active: true,
};

export default function AdminSchedulesPage() {
  const repos = getRepositories();
  const [exams] = useState<ExamDefinition[]>(() => repos.exams.list());
  const [batches] = useState<Batch[]>(() => repos.batches.list());
  const [schedules, setSchedules] = useState<ExamSchedule[]>(() =>
    repos.schedules.list(),
  );
  const [form, setForm] = useState({
    ...blank,
    examId: repos.exams.list()[0]?.id ?? "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  const examById = useMemo(
    () => new Map(exams.map((exam) => [exam.id, exam])),
    [exams],
  );
  const batchById = useMemo(
    () => new Map(batches.map((batch) => [batch.id, batch])),
    [batches],
  );

  const refresh = () => setSchedules(repos.schedules.list());

  const toggleBatch = (batchId: string) => {
    setForm((current) => ({
      ...current,
      batchIds: current.batchIds.includes(batchId)
        ? current.batchIds.filter((id) => id !== batchId)
        : [...current.batchIds, batchId],
    }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const existing = editingId ? repos.schedules.getById(editingId) : undefined;
    repos.schedules.save({
      ...(existing ?? createScheduleInput(form)),
      examId: form.examId,
      batchIds:
        form.visibilityRule === "all_active_students" ? [] : form.batchIds,
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      durationMinutes: Number(form.durationMinutes),
      visibilityRule: form.visibilityRule,
      active: form.active,
      updatedAt: Date.now(),
    });
    recordAuditEvent({
      actorRole: "admin",
      actionType: existing ? "schedule_edit" : "schedule_create",
      resourceType: "schedule",
      resourceId: existing?.id ?? form.examId,
      metadata: {
        examId: form.examId,
        batchIds: form.batchIds,
        startAtUTC: new Date(form.startAt).toISOString(),
        endAtUTC: new Date(form.endAt).toISOString(),
      },
    });
    await awaitRepositoryPersist();
    setEditingId(null);
    setForm({ ...blank, examId: exams[0]?.id ?? "" });
    refresh();
  };

  const edit = (schedule: ExamSchedule) => {
    setEditingId(schedule.id);
    setForm({
      examId: schedule.examId,
      batchIds: schedule.batchIds,
      startAt: toLocalInputValue(schedule.startAt),
      endAt: toLocalInputValue(schedule.endAt),
      durationMinutes: schedule.durationMinutes,
      visibilityRule: schedule.visibilityRule,
      active: schedule.active,
    });
  };

  const deactivate = async (id: string) => {
    repos.schedules.deactivate(id);
    recordAuditEvent({
      actorRole: "admin",
      actionType: "schedule_edit",
      resourceType: "schedule",
      resourceId: id,
      metadata: { active: false },
    });
    await awaitRepositoryPersist();
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Exam Scheduling</h1>
        <p className="text-sm text-gray-600">
          Assign exams to batches and control the visible testing window.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Edit Schedule" : "Create Schedule"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="exam">Exam</Label>
                <select
                  id="exam"
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={form.examId}
                  onChange={(e) => setForm({ ...form, examId: e.target.value })}
                  required
                >
                  {exams.map((exam) => (
                    <option key={exam.id} value={exam.id}>
                      {exam.title}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="start">Start</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={form.startAt}
                  onChange={(e) =>
                    setForm({ ...form, startAt: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="duration">Duration minutes</Label>
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  value={form.durationMinutes}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationMinutes: Number(e.target.value),
                    })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <select
                  id="visibility"
                  className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  value={form.visibilityRule}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      visibilityRule: e.target
                        .value as ExamSchedule["visibilityRule"],
                    })
                  }
                >
                  <option value="assigned_batches">Assigned batches</option>
                  <option value="all_active_students">All active students</option>
                </select>
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
                <Button type="submit" disabled={exams.length === 0}>
                  {editingId ? "Update" : "Create"}
                </Button>
              </div>
            </div>

            {form.visibilityRule === "assigned_batches" && (
              <div className="rounded border border-gray-200 p-3">
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Assigned batches
                </p>
                <div className="grid gap-2 md:grid-cols-3">
                  {batches.map((batch) => (
                    <label key={batch.id} className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.batchIds.includes(batch.id)}
                        onChange={() => toggleBatch(batch.id)}
                      />
                      {batch.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Exam</th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3">Batches</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {schedules.map((schedule) => (
              <tr key={schedule.id}>
                <td className="px-4 py-3 font-medium">
                  {examById.get(schedule.examId)?.title ?? schedule.examId}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  <p>{new Date(schedule.startAt).toLocaleString()}</p>
                  <p>{new Date(schedule.endAt).toLocaleString()}</p>
                  <p>{schedule.durationMinutes} minutes</p>
                </td>
                <td className="px-4 py-3 text-xs">
                  {schedule.visibilityRule === "all_active_students"
                    ? "All active students"
                    : schedule.batchIds
                        .map((id) => batchById.get(id)?.name ?? id)
                        .join(", ")}
                </td>
                <td className="px-4 py-3">
                  {schedule.active ? getScheduleStatus(schedule) : "inactive"}
                </td>
                <td className="space-x-2 px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => edit(schedule)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deactivate(schedule.id)}
                    disabled={!schedule.active}
                  >
                    Deactivate
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
