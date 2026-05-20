"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { getRepositories } from "@/lib/repositories/provider";
import { makeCbtId } from "@/lib/cbt/cbt-ids";
import { getQuestionBank } from "@/services/question-bank-service";
import {
  createScheduleInput,
  getScheduleStatus,
} from "@/services/institute-ops-service";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import type { Batch, InstituteStudent } from "@/types/institute-ops";
import type { CBTTest, CBTTestQuestion, CBTTestSection } from "@/types/cbt";
import type { BankQuestion } from "@/types/question-bank";

type SectionDraft = {
  localId: string;
  name: string;
  bankPickId: string;
  manualStem: string;
  manualOptA: string;
  manualOptB: string;
  manualOptC: string;
  manualOptD: string;
  manualCorrect: string;
  marks: string;
  negativeMarks: string;
};

function emptySection(): SectionDraft {
  return {
    localId: makeCbtId("sec-local"),
    name: "",
    bankPickId: "",
    manualStem: "",
    manualOptA: "",
    manualOptB: "",
    manualOptC: "",
    manualOptD: "",
    manualCorrect: "A",
    marks: "4",
    negativeMarks: "1",
  };
}

export function CbtTestsManager() {
  const session = useWorkspaceAuthStore((s) => s.session);
  const hydrate = useWorkspaceAuthStore((s) => s.hydrate);
  const [tests, setTests] = useState<CBTTest[]>([]);

  useEffect(() => {
    hydrate();
    setTests(getRepositories().cbtTests.list());
  }, [hydrate]);
  const [batches] = useState<Batch[]>(() =>
    typeof window === "undefined" ? [] : getRepositories().batches.list(),
  );
  const [students] = useState<InstituteStudent[]>(() =>
    typeof window === "undefined" ? [] : getRepositories().students.list(),
  );
  const bank = useMemo(() => getQuestionBank(), []);

  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("180");
  const [sections, setSections] = useState<SectionDraft[]>([emptySection()]);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    hydrate();
    setTests(getRepositories().cbtTests.list());
  }, [hydrate]);

  const instituteId = session?.instituteId ?? "";
  const createdBy = session?.userId ?? "unknown";

  const results = useMemo(() => {
    if (!selectedTestId) return [];
    return getRepositories().cbtAttempts.listByTestId(selectedTestId);
  }, [selectedTestId, tests]);

  const studentNameByRoll = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of students) {
      m.set(s.rollNumber, s.fullName);
    }
    return m;
  }, [students]);

  const buildTestFromDraft = (): CBTTest | null => {
    if (!title.trim() || !instituteId) return null;
    const testId = makeCbtId("cbt");
    const now = Date.now();
    const dur = Math.max(1, parseInt(duration, 10) || 60);

    const cbtSections: CBTTestSection[] = [];
    const questions: CBTTestQuestion[] = [];
    let totalMarks = 0;
    let order = 0;
    const sectionIdByName = new Map<string, string>();

    for (const sd of sections) {
      if (!sd.name.trim()) continue;
      const name = sd.name.trim();
      let sectionId = sectionIdByName.get(name);
      if (!sectionId) {
        sectionId = makeCbtId("cbt-sec");
        sectionIdByName.set(name, sectionId);
        cbtSections.push({
          id: sectionId,
          testId,
          name,
          order: order++,
        });
      }

      if (sd.bankPickId) {
        const bq = bank.find((q) => q.id === sd.bankPickId);
        if (!bq) continue;
        const marks = parseFloat(sd.marks) || bq.marks;
        const neg = parseFloat(sd.negativeMarks);
        const negativeMarks = Number.isFinite(neg) ? neg : bq.negativeMarks;
        totalMarks += marks;
        questions.push({
          id: makeCbtId("tq"),
          testId,
          sectionId,
          questionId: makeCbtId("examq"),
          source: "bank",
          bankQuestionId: bq.id,
          questionType: bq.questionType,
          marks,
          negativeMarks,
        });
      } else if (sd.manualStem.trim()) {
        const marks = parseFloat(sd.marks) || 4;
        const neg = parseFloat(sd.negativeMarks);
        const negativeMarks = Number.isFinite(neg) ? neg : 1;
        totalMarks += marks;
        const opts = [
          { label: "A", text: sd.manualOptA || "—" },
          { label: "B", text: sd.manualOptB || "—" },
          { label: "C", text: sd.manualOptC || "—" },
          { label: "D", text: sd.manualOptD || "—" },
        ];
        questions.push({
          id: makeCbtId("tq"),
          testId,
          sectionId,
          questionId: makeCbtId("examq"),
          source: "manual",
          questionType: "MCQ_SINGLE",
          manual: {
            text: sd.manualStem.trim(),
            options: opts,
            correctLabel: sd.manualCorrect || "A",
          },
          marks,
          negativeMarks,
        });
      }
    }

    if (cbtSections.length === 0 || questions.length === 0) return null;

    return {
      id: testId,
      title: title.trim(),
      instituteId,
      durationMinutes: dur,
      totalMarks,
      createdBy,
      sections: cbtSections,
      questions,
      batchIds: selectedBatchIds,
      createdAt: now,
      updatedAt: now,
    };
  };

  const saveTest = async () => {
    const test = buildTestFromDraft();
    if (!test) {
      alert("Add at least one section with a name and a question (bank or manual).");
      return;
    }
    getRepositories().cbtTests.save(test);

    if (
      selectedBatchIds.length > 0 &&
      scheduleStart &&
      scheduleEnd
    ) {
      const sched = createScheduleInput({
        examId: test.id,
        batchIds: selectedBatchIds,
        startAt: scheduleStart,
        endAt: scheduleEnd,
        durationMinutes: test.durationMinutes,
        visibilityRule: "assigned_batches",
        active: true,
      });
      getRepositories().schedules.save(sched);
    }

    await awaitRepositoryPersist();
    setTitle("");
    setDuration("180");
    setSections([emptySection()]);
    setSelectedBatchIds([]);
    setScheduleStart("");
    setScheduleEnd("");
    refresh();
  };

  const summaryForTest = (t: CBTTest) => {
    const attempts = getRepositories().cbtAttempts.listByTestId(t.id);
    const avg =
      attempts.length === 0
        ? "—"
        : (
            attempts.reduce((a, x) => a + (x.attempt.score ?? 0), 0) /
            attempts.length
          ).toFixed(1);
    return { count: attempts.length, avg };
  };

  const scheduleForTest = (testId: string) =>
    getRepositories().schedules.listByExamId(testId)[0] ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CBT Tests</h1>
        <p className="text-sm text-gray-600">
          Build institute tests, attach questions, assign batches, and schedule.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create test</CardTitle>
          <CardDescription>
            Sections accumulate questions. Pick from the bank or enter a quick MCQ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          {sections.map((sec, idx) => (
            <Card key={sec.localId} className="border-dashed">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Section {idx + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label>Section name</Label>
                  <Input
                    placeholder="Physics"
                    value={sec.name}
                    onChange={(e) => {
                      const next = [...sections];
                      next[idx] = { ...sec, name: e.target.value };
                      setSections(next);
                    }}
                  />
                </div>
                <div>
                  <Label>From question bank</Label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                    value={sec.bankPickId}
                    onChange={(e) => {
                      const next = [...sections];
                      next[idx] = { ...sec, bankPickId: e.target.value };
                      setSections(next);
                    }}
                  >
                    <option value="">— none —</option>
                    {bank.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.subject}: {q.questionText.slice(0, 60)}…
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500">Or manual MCQ (if bank empty)</p>
                <div>
                  <Label>Manual stem</Label>
                  <textarea
                    className="min-h-16 w-full rounded border border-gray-300 p-2 text-sm"
                    value={sec.manualStem}
                    onChange={(e) => {
                      const next = [...sections];
                      next[idx] = { ...sec, manualStem: e.target.value };
                      setSections(next);
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["manualOptA", "manualOptB", "manualOptC", "manualOptD"] as const).map(
                    (k, j) => (
                      <div key={k}>
                        <Label>Option {String.fromCharCode(65 + j)}</Label>
                        <Input
                          value={sec[k]}
                          onChange={(e) => {
                            const next = [...sections];
                            next[idx] = { ...sec, [k]: e.target.value };
                            setSections(next);
                          }}
                        />
                      </div>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Correct label</Label>
                    <Input
                      value={sec.manualCorrect}
                      onChange={(e) => {
                        const next = [...sections];
                        next[idx] = { ...sec, manualCorrect: e.target.value };
                        setSections(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Marks</Label>
                    <Input
                      value={sec.marks}
                      onChange={(e) => {
                        const next = [...sections];
                        next[idx] = { ...sec, marks: e.target.value };
                        setSections(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Negative</Label>
                    <Input
                      value={sec.negativeMarks}
                      onChange={(e) => {
                        const next = [...sections];
                        next[idx] = { ...sec, negativeMarks: e.target.value };
                        setSections(next);
                      }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => setSections((s) => [...s, emptySection()])}
          >
            Add section
          </Button>

          <div>
            <Label>Assign batches</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {batches.map((b) => (
                <label key={b.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(b.id)}
                    onChange={() => {
                      setSelectedBatchIds((ids) =>
                        ids.includes(b.id)
                          ? ids.filter((x) => x !== b.id)
                          : [...ids, b.id],
                      );
                    }}
                  />
                  {b.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Schedule start (local)</Label>
              <Input
                type="datetime-local"
                value={scheduleStart}
                onChange={(e) => setScheduleStart(e.target.value)}
              />
            </div>
            <div>
              <Label>Schedule end (local)</Label>
              <Input
                type="datetime-local"
                value={scheduleEnd}
                onChange={(e) => setScheduleEnd(e.target.value)}
              />
            </div>
          </div>

          <Button
            className="bg-[#1a3c6e] hover:bg-[#152d52]"
            type="button"
            onClick={() => void saveTest()}
          >
            Save test & schedule
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Published tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tests.length === 0 ? (
            <p className="text-sm text-gray-500">No CBT tests yet.</p>
          ) : (
            <ul className="divide-y rounded border bg-white text-sm">
              {tests.map((t) => {
                const { count, avg } = summaryForTest(t);
                const schedule = scheduleForTest(t.id);
                const scheduleStatus = schedule ? getScheduleStatus(schedule) : null;
                return (
                  <li
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-2"
                  >
                    <div>
                      <p className="font-medium">{t.title}</p>
                      <p className="text-xs text-gray-500">
                        {t.durationMinutes} min · {t.questions.length} Q · attempts{" "}
                        {count} · avg {avg}
                        {scheduleStatus ? (
                          <span> Â· {scheduleStatus}</span>
                        ) : (
                          <span> Â· unscheduled</span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() =>
                          setSelectedTestId((id) =>
                            id === t.id ? null : t.id,
                          )
                        }
                      >
                        Results
                      </Button>
                      <Link
                        href={`/institute/tests/${t.id}`}
                        className="inline-flex h-9 items-center rounded-md border border-gray-300 bg-white px-3 text-sm"
                      >
                        Open
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedTestId && (
            <div className="mt-4 overflow-auto rounded border">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2">Student</th>
                    <th className="p-2">Roll</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const correct = r.responses.filter((x) => x.isCorrect).length;
                    return (
                      <tr key={r.attempt.id} className="border-t">
                        <td className="p-2">
                          {studentNameByRoll.get(r.attempt.studentId) ?? "—"}
                        </td>
                        <td className="p-2">{r.attempt.studentId}</td>
                        <td className="p-2">{r.attempt.score ?? "—"}</td>
                        <td className="p-2">
                          {correct}/{r.responses.length}
                        </td>
                      </tr>
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
