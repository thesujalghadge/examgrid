"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildTestLeaderboard, findStudentRank } from "@/services/test-leaderboard";
import { listTestSessionsForTest } from "@/services/test-session-engine";
import type { LeaderboardEntry } from "@/types/test-session";

export function TestLeaderboardPanel({
  testId,
  instituteId,
  studentId,
  topN = 10,
}: {
  testId: string;
  instituteId: string;
  studentId: string;
  topN?: number;
}) {
  const [remote, setRemote] = useState<{
    leaderboard: LeaderboardEntry[];
    selfRank: LeaderboardEntry | null;
  } | null>(null);

  const local = useMemo(() => {
    const sessions = listTestSessionsForTest(testId, instituteId);
    return {
      leaderboard: buildTestLeaderboard(testId, sessions, {}, topN),
      selfRank: findStudentRank(testId, studentId, sessions),
    };
  }, [testId, instituteId, studentId, topN]);

  useEffect(() => {
    void fetch(`/api/cbt/leaderboard/${testId}?top=${topN}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setRemote(d as typeof remote);
      })
      .catch(() => {});
  }, [testId, topN]);

  const data =
    (local.leaderboard.length >= (remote?.leaderboard.length ?? 0)
      ? local
      : remote) ?? local;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Leaderboard</CardTitle>
        <CardDescription>
          Ranked by score; faster completion breaks ties.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm">
        {data.selfRank && (
          <p className="mb-3 rounded bg-[#1a3c6e]/10 px-3 py-2 font-medium text-[#1a3c6e]">
            Your rank: #{data.selfRank.rank} · {data.selfRank.score}/
            {data.selfRank.maxScore} · {data.selfRank.durationSeconds}s
            {data.selfRank.flagged ? " · under review" : ""}
          </p>
        )}
        {data.leaderboard.length === 0 ? (
          <p className="text-gray-500">No submissions yet.</p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-1">#</th>
                <th className="pb-1">Roll</th>
                <th className="pb-1">Score</th>
                <th className="pb-1">Time</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((e) => (
                <tr
                  key={e.studentId}
                  className={
                    e.studentId === studentId
                      ? "border-b bg-blue-50 font-medium"
                      : "border-b border-gray-100"
                  }
                >
                  <td className="py-1">{e.rank}</td>
                  <td className="py-1">{e.studentId}</td>
                  <td className="py-1">
                    {e.score}/{e.maxScore}
                  </td>
                  <td className="py-1">{e.durationSeconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
