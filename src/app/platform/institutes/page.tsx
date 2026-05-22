"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEMO_INSTITUTE } from "@/config/demo";
import { getRepositories } from "@/lib/repositories/provider";
import { getScheduleStatus } from "@/services/institute-ops-service";

export default function PlatformInstitutesPage() {
  const instituteRow = useMemo(() => {
    const repos = getRepositories();
    const activeWindows = repos.schedules.list().filter((schedule) => getScheduleStatus(schedule) === "active").length;
    return {
      name: DEMO_INSTITUTE.name,
      city: DEMO_INSTITUTE.city,
      plan: "Operational Beta",
      students: repos.students.list().length,
      tests: repos.cbtTests.list().length,
      activeWindows,
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#14213d]">Institutes</h2>
        <p className="text-sm text-[#5e5a52]">
          Activate, monitor, and support institute access with a single operational view.
        </p>
      </div>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#ece6da] text-[#6b7280]">
                <tr>
                  <th className="pb-3">Institute</th>
                  <th className="pb-3">Plan</th>
                  <th className="pb-3">Students</th>
                  <th className="pb-3">Tests</th>
                  <th className="pb-3">Live windows</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#f1ece4]">
                  <td className="py-3">
                    <p className="font-medium text-[#14213d]">{instituteRow.name}</p>
                    <p className="text-xs text-[#5e5a52]">{instituteRow.city}</p>
                  </td>
                  <td className="py-3">{instituteRow.plan}</td>
                  <td className="py-3">{instituteRow.students}</td>
                  <td className="py-3">{instituteRow.tests}</td>
                  <td className="py-3">{instituteRow.activeWindows}</td>
                  <td className="py-3">
                    <span className="rounded-full bg-[#e9f3ea] px-3 py-1 text-xs font-medium text-[#2f6a37]">
                      Active
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
