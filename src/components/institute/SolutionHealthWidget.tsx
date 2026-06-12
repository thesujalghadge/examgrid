"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getSolutionHealthOverview } from "@/app/institute/actions/solution-overview";
import { BrainCircuit } from "lucide-react";

import { Button } from "@/components/ui/button";
import Link from "next/link";

export function SolutionHealthWidget({ instituteId }: { instituteId: string }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!instituteId) return;
    getSolutionHealthOverview(instituteId).then((res) => {
      setData(res);
    });
  }, [instituteId]);

  if (!data) return null;

  return (
    <Card className="border-[#d8d2c7]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center">
          <BrainCircuit className="h-5 w-5 text-[#8a6f3e] mr-2" />
          <CardTitle className="text-base text-[#14213d]">Solution Generation Health</CardTitle>
        </div>
        <Link href="/institute/solution-queue">
          <Button variant="ghost" size="sm" className="text-sm">Manage Queue →</Button>
        </Link>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-2">
          <div>
            <p className="text-xs text-[#5e5a52] uppercase tracking-wider">Generated</p>
            <p className="text-2xl font-semibold text-[#14213d]">{data.generated}</p>
          </div>
          <div>
            <p className="text-xs text-[#5e5a52] uppercase tracking-wider">Pending</p>
            <p className="text-2xl font-semibold text-[#14213d]">{data.pending}</p>
          </div>
          <div>
            <p className="text-xs text-[#5e5a52] uppercase tracking-wider">Failed</p>
            <p className="text-2xl font-semibold text-red-600">{data.failed}</p>
          </div>
          <div>
            <p className="text-xs text-[#5e5a52] uppercase tracking-wider">Queue Depth</p>
            <p className="text-lg font-medium text-[#14213d]">{data.queueDepth}</p>
          </div>
          <div>
            <p className="text-xs text-[#5e5a52] uppercase tracking-wider">Success Rate</p>
            <p className="text-lg font-medium text-[#14213d]">{data.successRate}%</p>
          </div>
          <div>
            <p className="text-xs text-[#5e5a52] uppercase tracking-wider">Validation Issues</p>
            <p className="text-lg font-medium text-amber-600">{data.validationMismatches}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
