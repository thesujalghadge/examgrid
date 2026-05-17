"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { awaitRepositoryPersist } from "@/lib/repositories/await-persist";
import { examCatalogRepository } from "@/repositories/exam-catalog-repository";
import {
  buildExamDefinition,
  validateExamDraft,
} from "@/services/exam-builder-service";
import { getQuestionBank } from "@/services/question-bank-service";
import { SECTION_PRESETS, type ExamBuildDraft, type ExamSectionDraft } from "@/types/exam-builder";
import type { BankQuestion } from "@/types/question-bank";
import { cn } from "@/lib/utils";

function newSectionId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
}

function emptyDraft(): ExamBuildDraft {
  const scheduled = new Date();
  scheduled.setDate(scheduled.getDate() + 7);
  return {
    title: "",
    subtitle: "",
    examType: "JEE_MAIN",
    durationMinutes: 180,
    scheduledAt: scheduled.toISOString(),
    instructions: [],
    sections: [
      { id: newSectionId(), name: "Physics", questionIds: [] },
      { id: newSectionId(), name: "Chemistry", questionIds: [] },
    ],
  };
}

export function CreateExamForm() {
  const router = useRouter();
  const bank = useMemo(() => getQuestionBank(), []);
  const [draft, setDraft] = useState<ExamBuildDraft>(emptyDraft);
  const [errors, setErrors] = useState<string[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const [bankFilter, setBankFilter] = useState({
    subject: "all",
    search: "",
  });

  const filteredBank = useMemo(() => {
    const q = bankFilter.search.trim().toLowerCase();
    return bank.filter((item) => {
      if (bankFilter.subject !== "all" && item.subject !== bankFilter.subject)
        return false;
      if (!q) return true;
      return item.questionText.toLowerCase().includes(q);
    });
  }, [bank, bankFilter]);

  const subjects = useMemo(
    () => [...new Set(bank.map((q) => q.subject))].sort(),
    [bank],
  );

  const preview = useMemo(
    () => buildExamDefinition(draft, bank),
    [draft, bank],
  );

  const updateSection = (index: number, patch: Partial<ExamSectionDraft>) => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    }));
  };

  const toggleQuestion = (sectionIndex: number, questionId: string) => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.map((s, i) => {
        if (i !== sectionIndex) return s;
        const has = s.questionIds.includes(questionId);
        return {
          ...s,
          questionIds: has
            ? s.questionIds.filter((id) => id !== questionId)
            : [...s.questionIds, questionId],
        };
      }),
    }));
  };

  const addSection = (name: string) => {
    setDraft((d) => ({
      ...d,
      sections: [...d.sections, { id: newSectionId(), name, questionIds: [] }],
    }));
    setActiveSection(draft.sections.length);
  };

  const removeSection = (index: number) => {
    setDraft((d) => ({
      ...d,
      sections: d.sections.filter((_, i) => i !== index),
    }));
    setActiveSection(0);
  };

  const handlePublish = () => {
    void (async () => {
      const validation = validateExamDraft(draft);
      const built = buildExamDefinition(draft, bank);
      const allErrors = [
        ...validation.map((e) => e.message),
        ...built.errors.map((e) => e.message),
      ];
      if (allErrors.length > 0 || !built.exam) {
        setErrors(allErrors);
        return;
      }
      examCatalogRepository.save(built.exam);
      await awaitRepositoryPersist();
      router.push("/admin/exams");
    })();
  };

  const sec = draft.sections[activeSection];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section className="rounded border border-gray-200 bg-white p-4 space-y-4">
          <h2 className="font-semibold text-gray-900">Exam details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exam name *">
              <Input
                value={draft.title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, title: e.target.value }))
                }
                placeholder="JEE Main Mock Test 2"
              />
            </Field>
            <Field label="Subtitle">
              <Input
                value={draft.subtitle}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, subtitle: e.target.value }))
                }
              />
            </Field>
            <Field label="Duration (minutes) *">
              <Input
                type="number"
                min={1}
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    durationMinutes: Number(e.target.value) || 0,
                  }))
                }
              />
            </Field>
            <Field label="Exam type">
              <select
                className="h-9 w-full rounded border border-input px-2 text-sm"
                value={draft.examType}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    examType: e.target.value as ExamBuildDraft["examType"],
                  }))
                }
              >
                <option value="JEE_MAIN">JEE Main</option>
                <option value="NEET">NEET</option>
                <option value="CET">CET</option>
              </select>
            </Field>
            <Field label="Scheduled at">
              <Input
                type="datetime-local"
                value={draft.scheduledAt.slice(0, 16)}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    scheduledAt: new Date(e.target.value).toISOString(),
                  }))
                }
              />
            </Field>
          </div>
        </section>

        <section className="rounded border border-gray-200 bg-white p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold text-gray-900">Sections</h2>
            <div className="flex flex-wrap gap-1">
              {SECTION_PRESETS.map((name) => (
                <Button
                  key={name}
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={() => addSection(name)}
                >
                  + {name}
                </Button>
              ))}
              <Button
                type="button"
                size="xs"
                variant="outline"
                onClick={() => addSection("Custom Section")}
              >
                + Custom
              </Button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2 border-b border-gray-100 pb-2">
            {draft.sections.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveSection(i)}
                className={cn(
                  "rounded px-3 py-1 text-sm font-medium",
                  activeSection === i
                    ? "bg-[#1a3c6e] text-white"
                    : "bg-gray-100 text-gray-700",
                )}
              >
                {s.name} ({s.questionIds.length})
              </button>
            ))}
          </div>

          {sec && (
            <div className="space-y-3">
              <Field label="Section name">
                <Input
                  value={sec.name}
                  onChange={(e) =>
                    updateSection(activeSection, { name: e.target.value })
                  }
                />
              </Field>
              {draft.sections.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-red-600"
                  onClick={() => removeSection(activeSection)}
                >
                  Remove section
                </Button>
              )}

              <div className="rounded border border-gray-100 bg-gray-50 p-3">
                <p className="mb-2 text-xs font-semibold text-gray-600">
                  Assign questions from bank
                </p>
                <div className="mb-2 flex gap-2">
                  <Input
                    placeholder="Search bank…"
                    className="h-8 text-sm"
                    value={bankFilter.search}
                    onChange={(e) =>
                      setBankFilter((f) => ({ ...f, search: e.target.value }))
                    }
                  />
                  <select
                    className="h-8 rounded border border-input px-2 text-sm"
                    value={bankFilter.subject}
                    onChange={(e) =>
                      setBankFilter((f) => ({ ...f, subject: e.target.value }))
                    }
                  >
                    <option value="all">All subjects</option>
                    {subjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="max-h-64 space-y-2 overflow-y-auto">
                  {filteredBank.map((q) => (
                    <BankPickerRow
                      key={q.id}
                      question={q}
                      checked={sec.questionIds.includes(q.id)}
                      onToggle={() => toggleQuestion(activeSection, q.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Cannot publish</AlertTitle>
            <AlertDescription>
              <ul className="list-inside list-disc text-sm">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        <Button
          type="button"
          className="bg-green-700 hover:bg-green-800"
          onClick={handlePublish}
        >
          Publish exam to student portal
        </Button>
      </div>

      <aside className="rounded border border-gray-200 bg-white p-4 lg:sticky lg:top-4 lg:self-start">
        <h2 className="mb-3 font-semibold text-gray-900">Exam preview</h2>
        {preview.exam ? (
          <div className="space-y-3 text-sm">
            <p>
              <strong>{preview.exam.title}</strong>
            </p>
            <p className="text-gray-600">{preview.exam.subtitle}</p>
            <p>
              {preview.exam.durationMinutes} min · {preview.exam.totalQuestions}{" "}
              questions
            </p>
            {preview.exam.sections.map((s) => (
              <div key={s.id} className="rounded bg-gray-50 p-2">
                <p className="font-medium text-[#1a3c6e]">{s.name}</p>
                <p className="text-xs text-gray-500">
                  {s.questionIds.length} question(s)
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Complete sections and assign questions to see preview.
          </p>
        )}
      </aside>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      {children}
    </div>
  );
}

function BankPickerRow({
  question: q,
  checked,
  onToggle,
}: {
  question: BankQuestion;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-2 rounded border p-2 text-xs",
        checked ? "border-[#1a3c6e] bg-blue-50" : "border-gray-200 bg-white",
      )}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5" />
      <span>
        <span className="font-medium">{q.subject}</span> · {q.questionType} ·{" "}
        <span className="line-clamp-1 text-gray-700">{q.questionText}</span>
      </span>
    </label>
  );
}
