"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { analyzeQuestionMetadataQuality } from "@/lib/question-intelligence/quality";
import type { BankQuestion } from "@/types/question-bank";
import { cn } from "@/lib/utils";

interface QuestionBankListProps {
  questions: BankQuestion[];
}

export function QuestionBankList({ questions }: QuestionBankListProps) {
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [type, setType] = useState("all");
  const [chapter, setChapter] = useState("all");

  const subjects = useMemo(
    () => [...new Set(questions.map((q) => q.subject))].sort(),
    [questions],
  );
  const chapters = useMemo(
    () => [...new Set(questions.map((q) => q.chapter))].sort(),
    [questions],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter((item) => {
      if (subject !== "all" && item.subject !== subject) return false;
      if (difficulty !== "all" && item.difficulty !== difficulty) return false;
      if (type !== "all" && item.questionType !== type) return false;
      if (chapter !== "all" && item.chapter !== chapter) return false;
      if (!q) return true;
      return (
        item.questionText.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q) ||
        item.chapter.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q)
      );
    });
  }, [questions, search, subject, difficulty, type, chapter]);

  const quality = useMemo(
    () => analyzeQuestionMetadataQuality(questions),
    [questions],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded border border-gray-200 bg-white p-4 sm:grid-cols-5">
        <QualityStat label="Missing metadata" value={quality.missingMetadataCount} />
        <QualityStat label="Incomplete taxonomy" value={quality.incompleteTaxonomyCount} />
        <QualityStat label="Orphan topics" value={quality.orphanTopicCount} />
        <QualityStat label="Low quality" value={quality.lowQualityCount} />
        <QualityStat label="Duplicate candidates" value={quality.duplicateCandidateCount} />
      </div>

      <div className="grid gap-3 rounded border border-gray-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5">
        <FilterField label="Search">
          <Input
            placeholder="Text, topic, id…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </FilterField>
        <FilterField label="Subject">
          <select
            className="h-9 w-full rounded border border-input bg-transparent px-2 text-sm"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          >
            <option value="all">All</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Chapter">
          <select
            className="h-9 w-full rounded border border-input bg-transparent px-2 text-sm"
            value={chapter}
            onChange={(e) => setChapter(e.target.value)}
          >
            <option value="all">All</option>
            {chapters.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Difficulty">
          <select
            className="h-9 w-full rounded border border-input bg-transparent px-2 text-sm"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="all">All</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </FilterField>
        <FilterField label="Type">
          <select
            className="h-9 w-full rounded border border-input bg-transparent px-2 text-sm"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="all">All</option>
            <option value="MCQ_SINGLE">MCQ</option>
            <option value="NUMERICAL">Numerical</option>
          </select>
        </FilterField>
      </div>

      <p className="text-sm text-gray-600">
        Showing {filtered.length} of {questions.length} questions
      </p>

      <div className="space-y-3">
        {filtered.map((q) => (
          <QuestionRow key={q.id} question={q} />
        ))}
        {filtered.length === 0 && (
          <p className="rounded border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
            No questions match filters.
          </p>
        )}
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-gray-500">{label}</Label>
      {children}
    </div>
  );
}

function QuestionRow({ question: q }: { question: BankQuestion }) {
  return (
    <article className="rounded border border-gray-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge className="bg-[#1a3c6e]/10 text-[#1a3c6e]">{q.subject}</Badge>
        <Badge className="bg-gray-100 text-gray-700">{q.chapter}</Badge>
        <Badge
          className={cn(
            q.questionType === "NUMERICAL"
              ? "bg-violet-100 text-violet-800"
              : "bg-blue-100 text-blue-800",
          )}
        >
          {q.questionType === "NUMERICAL" ? "Numerical" : "MCQ"}
        </Badge>
        <Badge className="bg-amber-50 text-amber-800">{q.difficulty}</Badge>
        <Badge className="bg-emerald-50 text-emerald-800">{q.sourceType}</Badge>
        <span className="text-xs text-gray-400">{q.id}</span>
      </div>
      <p className="line-clamp-2 text-sm text-gray-900">{q.questionText}</p>
      <p className="mt-2 text-xs text-gray-500">
        Topic: {q.topic} · Marks: +{q.marks}
        {q.negativeMarks > 0 ? ` / −${q.negativeMarks}` : ""} · Answer:{" "}
        {q.correctAnswer}
      </p>
      <p className="mt-1 text-xs text-gray-400">
        {q.examSource}
        {q.examYear ? ` ${q.examYear}` : ""} · {q.subtopic || "No subtopic"} ·
        fingerprint {q.similarityFingerprint || "pending"}
      </p>
    </article>
  );
}

function QualityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded bg-gray-50 p-3">
      <p className="text-[10px] font-semibold uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#1a3c6e]">{value}</p>
    </div>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {children}
    </span>
  );
}
