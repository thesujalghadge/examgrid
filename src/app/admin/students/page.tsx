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
  createStudentInput,
  importPreviewedStudents,
  previewStudentCsvImport,
} from "@/services/institute-ops-service";
import type {
  Batch,
  InstituteStudent,
  StudentImportPreview,
} from "@/types/institute-ops";

const blank = {
  fullName: "",
  email: "",
  phone: "",
  rollNumber: "",
  courseType: "JEE",
  batchId: "",
  active: true,
};

export default function AdminStudentsPage() {
  const repos = getRepositories();
  const [students, setStudents] = useState<InstituteStudent[]>(() =>
    repos.students.list(),
  );
  const [batches] = useState<Batch[]>(() => repos.batches.list());
  const [form, setForm] = useState({
    ...blank,
    batchId: repos.batches.list().find((batch) => batch.active)?.id ?? "",
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [csv, setCsv] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);

  const batchById = useMemo(
    () => new Map(batches.map((batch) => [batch.id, batch])),
    [batches],
  );
  const visibleStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) =>
      [student.fullName, student.rollNumber, student.email, student.courseType]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [search, students]);

  const refresh = () => setStudents(repos.students.list());

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const existing = editingId ? repos.students.getById(editingId) : undefined;
    repos.students.save({
      ...(existing ?? createStudentInput(form)),
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      rollNumber: form.rollNumber.trim(),
      courseType: form.courseType.trim(),
      batchId: form.batchId,
      active: form.active,
      updatedAt: Date.now(),
    });
    recordAuditEvent({
      actorRole: "admin",
      actionType: existing ? "student_edit" : "student_create",
      resourceType: "student",
      resourceId: existing?.id ?? form.rollNumber,
      metadata: { rollNumber: form.rollNumber, batchId: form.batchId },
    });
    await awaitRepositoryPersist();
    setEditingId(null);
    setForm({ ...blank, batchId: batches.find((b) => b.active)?.id ?? "" });
    refresh();
  };

  const edit = (student: InstituteStudent) => {
    setEditingId(student.id);
    setForm({
      fullName: student.fullName,
      email: student.email,
      phone: student.phone,
      rollNumber: student.rollNumber,
      courseType: student.courseType,
      batchId: student.batchId,
      active: student.active,
    });
  };

  const deactivate = async (id: string) => {
    repos.students.deactivate(id);
    recordAuditEvent({
      actorRole: "admin",
      actionType: "student_deactivate",
      resourceType: "student",
      resourceId: id,
    });
    await awaitRepositoryPersist();
    refresh();
  };

  const runPreview = () => {
    setPreview(previewStudentCsvImport(csv, students, batches));
  };

  const commitImport = async () => {
    if (!preview) return;
    await importPreviewedStudents(preview);
    recordAuditEvent({
      actorRole: "admin",
      actionType: "student_import",
      resourceType: "student",
      resourceId: "bulk_csv",
      metadata: {
        validCount: preview.validCount,
        duplicateCount: preview.duplicateCount,
        errorCount: preview.errorCount,
      },
    });
    setCsv("");
    setPreview(null);
    refresh();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Student Management</h1>
        <p className="text-sm text-gray-600">
          Add students, assign roll numbers, place them into batches, and control
          active access.
        </p>
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search students by name, roll, email, or course"
        className="max-w-md bg-white"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Edit Student" : "Add Student"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                value={form.fullName}
                onChange={(e) =>
                  setForm({ ...form, fullName: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll">Roll number</Label>
              <Input
                id="roll"
                value={form.rollNumber}
                onChange={(e) =>
                  setForm({ ...form, rollNumber: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
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
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="batch">Batch</Label>
              <select
                id="batch"
                className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                value={form.batchId}
                onChange={(e) => setForm({ ...form, batchId: e.target.value })}
                required
              >
                <option value="">Select batch</option>
                {batches.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.name} ({batch.courseType})
                  </option>
                ))}
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
              <Button type="submit" disabled={batches.length === 0}>
                {editingId ? "Update" : "Add"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bulk CSV Import</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="min-h-28 w-full rounded-md border border-gray-300 p-3 font-mono text-xs"
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
            placeholder="fullName,email,phone,rollNumber,courseType,batch&#10;Anita Rao,anita@example.com,9876543210,JEE26001,JEE,JEE 2026 A"
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={runPreview}>
              Preview Import
            </Button>
            <Button
              type="button"
              onClick={commitImport}
              disabled={!preview || preview.errorCount > 0}
            >
              Import Valid Rows
            </Button>
          </div>
          {preview && (
            <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
              <p>
                {preview.validCount} valid, {preview.duplicateCount} duplicate,{" "}
                {preview.errorCount} with errors.
              </p>
              <div className="mt-2 max-h-48 overflow-auto">
                {preview.rows.map((row) => (
                  <p key={row.index} className="text-xs text-gray-700">
                    Line {row.index}: {row.student.fullName || "Unnamed"} —{" "}
                    {row.errors.length ? row.errors.join("; ") : "ready"}
                  </p>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="overflow-hidden rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Roll</th>
              <th className="px-4 py-3">Batch</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleStudents.map((student) => (
              <tr key={student.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{student.fullName}</p>
                  <p className="text-xs text-gray-500">{student.courseType}</p>
                </td>
                <td className="px-4 py-3">{student.rollNumber}</td>
                <td className="px-4 py-3">
                  {batchById.get(student.batchId)?.name ?? "Unassigned"}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  <p>{student.email || "-"}</p>
                  <p>{student.phone || "-"}</p>
                </td>
                <td className="px-4 py-3">
                  {student.active ? "Active" : "Inactive"}
                </td>
                <td className="space-x-2 px-4 py-3 text-right">
                  <Button size="sm" variant="outline" onClick={() => edit(student)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deactivate(student.id)}
                    disabled={!student.active}
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
