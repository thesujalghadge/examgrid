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
import { cbtTestToExamDefinition } from "@/lib/cbt/cbt-to-exam";
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
  const hydrateSession = useWorkspaceAuthStore((s) => s.hydrateSession);
  const [tests, setTests] = useState<CBTTest[]>([]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

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
    setTests(getRepositories().cbtTests.list());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const instituteId = session?.instituteId ?? "";
  const createdBy = session?.userId ?? "unknown";

  const results = useMemo(() => {
    if (!selectedTestId) return [];
    return getRepositories().cbtAttempts.listByTestId(selectedTestId);
  }, [selectedTestId]);

  const studentNameByRoll = useMemo(() => {
    const map = new Map<string, string>();
    for (const student of students) {
      map.set(student.rollNumber, student.fullName);
    }
    return map;
  }, [students]);

  const buildTestFromDraft = (): CBTTest | null => {
    if (!title.trim() || !instituteId) return null;

    const testId = makeCbtId("cbt");
    const now = Date.now();
    const durationMinutes = Math.max(1, parseInt(duration, 10) || 60);

    const builtSections: CBTTestSection[] = [];
    const builtQuestions: CBTTestQuestion[] = [];
    const sectionIdByName = new Map<string, string>();
    let totalMarks = 0;
    let order = 0;

    for (const draft of sections) {
      if (!draft.name.trim()) continue;

      const sectionName = draft.name.trim();
      let sectionId = sectionIdByName.get(sectionName);
      if (!sectionId) {
        sectionId = makeCbtId("cbt-sec");
        sectionIdByName.set(sectionName, sectionId);
        builtSections.push({
          id: sectionId,
          testId,
          name: sectionName,
          order: order++,
        });
      }

      if (draft.bankPickId) {
        const bankQuestion = bank.find((question) => question.id === draft.bankPickId);
        if (!bankQuestion) continue;

        const marks = parseFloat(draft.marks) || bankQuestion.marks;
        const negative = parseFloat(draft.negativeMarks);
        const negativeMarks = Number.isFinite(negative)
          ? negative
          : bankQuestion.negativeMarks;

        totalMarks += marks;
        builtQuestions.push({
          id: makeCbtId("tq"),
          testId,
          sectionId,
          questionId: makeCbtId("examq"),
          source: "bank",
          bankQuestionId: bankQuestion.id,
          questionType: bankQuestion.questionType,
          marks,
          negativeMarks,
        });
        continue;
      }

      if (!draft.manualStem.trim()) continue;

      const marks = parseFloat(draft.marks) || 4;
      const negative = parseFloat(draft.negativeMarks);
      const negativeMarks = Number.isFinite(negative) ? negative : 1;
      totalMarks += marks;

      builtQuestions.push({
        id: makeCbtId("tq"),
        testId,
        sectionId,
        questionId: makeCbtId("examq"),
        source: "manual",
        questionType: "MCQ_SINGLE",
        manual: {
          text: draft.manualStem.trim(),
          options: [
            { label: "A", text: draft.manualOptA || "-" },
            { label: "B", text: draft.manualOptB || "-" },
            { label: "C", text: draft.manualOptC || "-" },
            { label: "D", text: draft.manualOptD || "-" },
          ],
          correctLabel: draft.manualCorrect || "A",
        },
        marks,
        negativeMarks,
      });
    }

    if (builtSections.length === 0 || builtQuestions.length === 0) return null;

    return {
      id: testId,
      title: title.trim(),
      instituteId,
      durationMinutes,
      totalMarks,
      createdBy,
      sections: builtSections,
      questions: builtQuestions,
      batchIds: selectedBatchIds,
      createdAt: now,
      updatedAt: now,
    };
  };

  const saveTest = async () => {
    const test = buildTestFromDraft();
    if (!test) {
      alert("Add at least one named section with a question from the bank or a manual MCQ.");
      return;
    }

    getRepositories().cbtTests.save(test);
    const examDefinition = cbtTestToExamDefinition(test);
    if (examDefinition) {
      getRepositories().exams.save(examDefinition);
    }

    if (selectedBatchIds.length > 0 && scheduleStart && scheduleEnd) {
      const schedule = createScheduleInput({
        examId: test.id,
        batchIds: selectedBatchIds,
        startAt: scheduleStart,
        endAt: scheduleEnd,
        durationMinutes: test.durationMinutes,
        visibilityRule: "assigned_batches",
        active: true,
      });
      getRepositories().schedules.save(schedule);
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

  const summaryForTest = (test: CBTTest) => {
    const attempts = getRepositories().cbtAttempts.listByTestId(test.id);
    const average =
      attempts.length === 0
        ? "-"
        : (
            attempts.reduce((sum, attempt) => sum + (attempt.attempt.score ?? 0), 0) /
            attempts.length
          ).toFixed(1);

    return { count: attempts.length, average };
  };

  const scheduleForTest = (testId: string) =>
    getRepositories().schedules.listByExamId(testId)[0] ?? null;

  return (
    <div className="space-y-6">
      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Build the test</CardTitle>
          <CardDescription>
            Use question-bank entries or add quick manual MCQs, then assign batches and a live
            window.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Test title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input value={duration} onChange={(event) => setDuration(event.target.value)} />
            </div>
          </div>

          {sections.map((section, index) => (
            <Card key={section.localId} className="border-dashed border-[#d8d2c7]">
              <CardHeader className="py-3">
                <CardTitle className="text-sm text-[#14213d]">Section {index + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div>
                  <Label>Section name</Label>
                  <Input
                    placeholder="Physics"
                    value={section.name}
                    onChange={(event) => {
                      const next = [...sections];
                      next[index] = { ...section, name: event.target.value };
                      setSections(next);
                    }}
                  />
                </div>
                <div>
                  <Label>Pick from question bank</Label>
                  <select
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm"
                    value={section.bankPickId}
                    onChange={(event) => {
                      const next = [...sections];
                      next[index] = { ...section, bankPickId: event.target.value };
                      setSections(next);
                    }}
                  >
                    <option value="">- none -</option>
                    {bank.map((question) => (
                      <option key={question.id} value={question.id}>
                        {question.subject}: {question.questionText.slice(0, 60)}...
                      </option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-gray-500">
                  Or add one quick manual MCQ if the bank entry is not ready.
                </p>
                <div>
                  <Label>Manual stem</Label>
                  <textarea
                    className="min-h-16 w-full rounded border border-gray-300 p-2 text-sm"
                    value={section.manualStem}
                    onChange={(event) => {
                      const next = [...sections];
                      next[index] = { ...section, manualStem: event.target.value };
                      setSections(next);
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(["manualOptA", "manualOptB", "manualOptC", "manualOptD"] as const).map(
                    (key, optionIndex) => (
                      <div key={key}>
                        <Label>Option {String.fromCharCode(65 + optionIndex)}</Label>
                        <Input
                          value={section[key]}
                          onChange={(event) => {
                            const next = [...sections];
                            next[index] = { ...section, [key]: event.target.value };
                            setSections(next);
                          }}
                        />
                      </div>
                    ),
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label>Correct option</Label>
                    <Input
                      value={section.manualCorrect}
                      onChange={(event) => {
                        const next = [...sections];
                        next[index] = { ...section, manualCorrect: event.target.value };
                        setSections(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Marks</Label>
                    <Input
                      value={section.marks}
                      onChange={(event) => {
                        const next = [...sections];
                        next[index] = { ...section, marks: event.target.value };
                        setSections(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Negative marks</Label>
                    <Input
                      value={section.negativeMarks}
                      onChange={(event) => {
                        const next = [...sections];
                        next[index] = { ...section, negativeMarks: event.target.value };
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
            className="bg-white"
            onClick={() => setSections((current) => [...current, emptySection()])}
          >
            Add section
          </Button>

          <div>
            <Label>Assign batches</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {batches.map((batch) => (
                <label key={batch.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(batch.id)}
                    onChange={() => {
                      setSelectedBatchIds((current) =>
                        current.includes(batch.id)
                          ? current.filter((value) => value !== batch.id)
                          : [...current, batch.id],
                      );
                    }}
                  />
                  {batch.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Schedule start</Label>
              <Input
                type="datetime-local"
                value={scheduleStart}
                onChange={(event) => setScheduleStart(event.target.value)}
              />
            </div>
            <div>
              <Label>Schedule end</Label>
              <Input
                type="datetime-local"
                value={scheduleEnd}
                onChange={(event) => setScheduleEnd(event.target.value)}
              />
            </div>
          </div>

          <Button
            className="bg-[#14213d] hover:bg-[#0f1a31]"
            type="button"
            onClick={() => void saveTest()}
          >
            Save test and schedule
          </Button>
        </CardContent>
      </Card>

      <Card className="border-[#d8d2c7]">
        <CardHeader>
          <CardTitle className="text-base text-[#14213d]">Published tests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tests.length === 0 ? (
            <p className="text-sm text-gray-500">No CBT tests yet.</p>
          ) : (
            <ul className="divide-y rounded border border-[#ece6da] bg-white text-sm">
              {tests.map((test) => {
                const { count, average } = summaryForTest(test);
                const schedule = scheduleForTest(test.id);
                const scheduleStatus = schedule ? getScheduleStatus(schedule) : null;
                return (
                  <li
                    key={test.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-3 py-3"
                  >
                    <div>
                      <p className="font-medium text-[#14213d]">{test.title}</p>
                      <p className="text-xs text-gray-500">
                        {test.durationMinutes} min | {test.questions.length} questions | attempts{" "}
                        {count} | avg {average}
                        {scheduleStatus ? ` | ${scheduleStatus}` : " | unscheduled"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        className="bg-white"
                        onClick={() =>
                          setSelectedTestId((current) => (current === test.id ? null : test.id))
                        }
                      >
                        Results
                      </Button>
                      <Link
                        href={`/institute/tests/${test.id}`}
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

          {selectedTestId ? (
            <div className="mt-4 overflow-auto rounded border border-[#ece6da]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#fbf9f4]">
                  <tr>
                    <th className="p-2">Student</th>
                    <th className="p-2">Roll</th>
                    <th className="p-2">Score</th>
                    <th className="p-2">Correct</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => {
                    const correct = result.responses.filter((response) => response.isCorrect).length;
                    return (
                      <tr key={result.attempt.id} className="border-t border-[#ece6da]">
                        <td className="p-2">
                          {studentNameByRoll.get(result.attempt.studentId) ?? "-"}
                        </td>
                        <td className="p-2">{result.attempt.studentId}</td>
                        <td className="p-2">{result.attempt.score ?? "-"}</td>
                        <td className="p-2">
                          {correct}/{result.responses.length}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
