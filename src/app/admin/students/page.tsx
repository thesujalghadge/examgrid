"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DashboardPanel, PageHeader, SectionHeader, StatusBadge } from "@/components/shared/product-ui";
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
import { Search, Mail, Phone, MoreVertical } from "lucide-react";

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
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Student Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage enrollments, batches, and active access.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search students..."
            className="w-full pl-9 bg-card border-input"
          />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        {/* Main Table Area */}
        <div className="space-y-4">
          <SectionHeader title="Student Roster" />
          
          {/* Mobile Card View (Hidden on sm+) */}
          <div className="grid gap-4 sm:hidden">
            {visibleStudents.map((student) => (
              <div key={student.id} className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-foreground">{student.fullName}</h3>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">{student.rollNumber}</p>
                  </div>
                  <StatusBadge tone={student.active ? "green" : "neutral"}>
                    {student.active ? "Active" : "Inactive"}
                  </StatusBadge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                    {batchById.get(student.batchId)?.name ?? "Unassigned"}
                  </span>
                  <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">
                    {student.courseType}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 mt-1 text-xs text-muted-foreground">
                  {student.email && (
                    <div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{student.email}</div>
                  )}
                  {student.phone && (
                    <div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{student.phone}</div>
                  )}
                </div>
                <div className="mt-2 flex gap-2 border-t border-border pt-3">
                  <Button size="sm" variant="outline" className="flex-1 h-8" onClick={() => edit(student)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 text-destructive hover:bg-destructive/10"
                    onClick={() => deactivate(student.id)}
                    disabled={!student.active}
                  >
                    Deactivate
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View (Hidden on mobile) */}
          <div className="hidden sm:block overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/50 border-b border-border sticky top-0 z-10">
                  <tr>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium">Student</th>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium">Roll</th>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium">Batch</th>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium">Contact</th>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium">Status</th>
                    <th className="px-5 py-3 text-meta text-muted-foreground font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleStudents.map((student) => (
                    <tr key={student.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-4 text-table">
                        <p className="font-medium text-foreground">{student.fullName}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{student.courseType}</p>
                      </td>
                      <td className="px-5 py-4 text-table font-mono text-muted-foreground">{student.rollNumber}</td>
                      <td className="px-5 py-4 text-table text-foreground">
                        {batchById.get(student.batchId)?.name ?? "Unassigned"}
                      </td>
                      <td className="px-5 py-4 text-table text-muted-foreground">
                        <p>{student.email || "-"}</p>
                        <p>{student.phone || "-"}</p>
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge tone={student.active ? "green" : "neutral"}>
                          {student.active ? "Active" : "Inactive"}
                        </StatusBadge>
                      </td>
                      <td className="space-x-2 px-5 py-4 text-right">
                        <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => edit(student)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => deactivate(student.id)}
                          disabled={!student.active}
                        >
                          Deactivate
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {visibleStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">
                        No students found matching your criteria.
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
            <SectionHeader title={editingId ? "Edit Student" : "Add Student"} />
            <form onSubmit={save} className="grid gap-4">
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
              <div className="grid grid-cols-2 gap-4">
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
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="batch">Batch</Label>
                  <select
                    id="batch"
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={form.batchId}
                    onChange={(e) => setForm({ ...form, batchId: e.target.value })}
                    required
                  >
                    <option value="">Select batch</option>
                    {batches.map((batch) => (
                      <option key={batch.id} value={batch.id}>
                        {batch.name}
                      </option>
                    ))}
                  </select>
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
                <Button type="submit" disabled={batches.length === 0}>
                  {editingId ? "Update Student" : "Add Student"}
                </Button>
              </div>
            </form>
          </DashboardPanel>

          <DashboardPanel>
            <SectionHeader title="Bulk CSV Import" />
            <div className="space-y-3">
              <textarea
                className="min-h-28 w-full rounded-md border border-input bg-background p-3 font-mono text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={csv}
                onChange={(e) => setCsv(e.target.value)}
                placeholder="fullName,email,phone,rollNumber,courseType,batch&#10;Anita Rao,anita@example.com,9876543210,JEE26001,JEE,JEE 2026 A"
              />
              <div className="flex gap-2">
                <Button type="button" variant="secondary" className="w-full" onClick={runPreview}>
                  Preview
                </Button>
                <Button
                  type="button"
                  className="w-full"
                  onClick={commitImport}
                  disabled={!preview || preview.errorCount > 0}
                >
                  Import
                </Button>
              </div>
              {preview && (
                <div className="rounded-lg border border-border bg-muted/50 p-3 text-sm">
                  <div className="flex gap-2 mb-2">
                    <StatusBadge tone="green">{preview.validCount} valid</StatusBadge>
                    <StatusBadge tone={preview.duplicateCount > 0 ? "amber" : "neutral"}>{preview.duplicateCount} dupes</StatusBadge>
                    <StatusBadge tone={preview.errorCount > 0 ? "red" : "neutral"}>{preview.errorCount} errors</StatusBadge>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1 mt-2 pr-2">
                    {preview.rows.map((row) => (
                      <p key={row.index} className="text-xs text-muted-foreground flex justify-between border-b border-border/50 pb-1 last:border-0">
                        <span>L{row.index}: {row.student.fullName || "Unnamed"}</span>
                        <span className={row.errors.length ? "text-destructive font-medium" : "text-emerald-600 dark:text-emerald-400"}>
                          {row.errors.length ? row.errors.join("; ") : "Ready"}
                        </span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}
