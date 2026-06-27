"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstituteApiKeySection } from "@/components/platform/institute-api-key-section";
import {
  createPlatformInstitute,
  deletePlatformInstituteRemote,
  listPlatformInstitutes,
  savePlatformInstituteRemote,
  setPlatformInstituteStatusRemote,
} from "@/lib/platform-institute-registry";
import { getRepositories } from "@/lib/repositories/provider";
import { getScheduleStatus } from "@/services/institute-ops-service";
import type { PlatformInstitute } from "@/types/platform-institute";

export function PlatformInstitutesManager() {
  const [rows, setRows] = useState<PlatformInstitute[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setRows(listPlatformInstitutes());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const statsFor = (instituteId: string) => {
    const repos = getRepositories();
    const students = repos.students.list().filter((s) => s.instituteId === instituteId);
    const tests = repos.exams.list();
    const active = repos.schedules
      .list()
      .filter(
        (s) =>
          s.instituteId === instituteId && getScheduleStatus(s) === "active",
      ).length;
    return { students: students.length, tests: tests.length, active };
  };

  const resetForm = () => {
    setName("");
    setCity("");
    setAdminEmail("");
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!name.trim() || !adminEmail.trim()) return;
    try {
      if (editingId) {
        const existing = rows.find((r) => r.id === editingId);
        if (existing) {
          await savePlatformInstituteRemote({
            ...existing,
            name: name.trim(),
            city: city.trim(),
            adminEmail: adminEmail.trim(),
          });
        }
      } else {
        await createPlatformInstitute({
          name: name.trim(),
          city: city.trim(),
          adminEmail: adminEmail.trim(),
        });
      }
      resetForm();
      refresh();
    } catch (error: unknown) {
      const err = error as Error;
      alert(`Failed to save institute: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">
            {editingId ? "Edit institute" : "Add institute"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>City</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Admin email</Label>
            <Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button className="bg-[#14213d]" onClick={handleSave}>
              {editingId ? "Update Info" : "Add Institute"}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Institute directory</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-[#5e5a52]">
              No institutes yet. Add one to begin onboarding.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-[#ece6da] text-[#6b7280]">
                  <tr>
                    <th className="pb-3">Institute</th>
                    <th className="pb-3">ID</th>
                    <th className="pb-3">Students</th>
                    <th className="pb-3">Tests</th>
                    <th className="pb-3">Live</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const st = statsFor(row.id);
                    return (
                      <Fragment key={row.id}>
                      <tr className="border-b border-[#f1ece4]">
                        <td className="py-3">
                          <p className="font-medium text-[#14213d]">{row.name}</p>
                          <p className="text-xs text-[#5e5a52]">{row.city}</p>
                        </td>
                        <td className="py-3 font-mono text-xs">{row.id}</td>
                        <td className="py-3">{st.students}</td>
                        <td className="py-3">{st.tests}</td>
                        <td className="py-3">{st.active}</td>
                        <td className="py-3">
                          <span
                            className={
                              row.status === "active"
                                ? "rounded-full bg-[#e9f3ea] px-2 py-0.5 text-xs text-[#2f6a37]"
                                : "rounded-full bg-[#f5f1e8] px-2 py-0.5 text-xs text-[#5e5a52]"
                            }
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingId(row.id);
                                setName(row.name);
                                setCity(row.city);
                                setAdminEmail(row.adminEmail);
                              }}
                            >
                              Edit Info
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                void setPlatformInstituteStatusRemote(
                                  row.id,
                                  row.status === "active" ? "inactive" : "active",
                                ).then(refresh);
                              }}
                            >
                              {row.status === "active" ? "Deactivate" : "Activate"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700"
                              onClick={() => {
                                if (confirm(`Remove ${row.name}?`)) {
                                  void deletePlatformInstituteRemote(row.id).then(refresh);
                                }
                              }}
                            >
                              Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                      <tr className="border-b-4 border-[#ece6da]">
                        <td colSpan={7} className="pb-4 pt-2">
                           <InstituteApiKeySection instituteId={row.id} />
                        </td>
                      </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
