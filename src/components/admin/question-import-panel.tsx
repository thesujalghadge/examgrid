"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { suggestTaxonomyTags } from "@/lib/academic-taxonomy";
import {
  importQuestionsFromText,
  parseAndValidateManualQuestion,
  type ImportDiagnostics,
  type ImportMetadataPreview,
  type ImportValidationError,
  type QuestionImportFormat,
} from "@/services/question-import-service";

interface QuestionImportPanelProps {
  onImported: () => void;
}

export function QuestionImportPanel({ onImported }: QuestionImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<ImportValidationError[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [preview, setPreview] = useState<ImportMetadataPreview | null>(null);
  const [diagnostics, setDiagnostics] = useState<ImportDiagnostics | null>(null);
  const [format, setFormat] = useState<QuestionImportFormat>("json");
  const [allowPartial, setAllowPartial] = useState(true);
  const [manual, setManual] = useState({
    examSource: "JEE Main",
    examYear: "",
    subject: "Physics",
    chapter: "",
    topic: "",
    subtopic: "",
    difficultyLevel: "medium",
    questionType: "MCQ_SINGLE",
    questionText: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "",
    solutionShort: "",
    solutionDetailed: "",
  });

  const suggestions = suggestTaxonomyTags({
    examType: "JEE_MAIN",
    subject: manual.subject,
    chapterQuery: manual.chapter,
    topicQuery: manual.topic,
    subtopicQuery: manual.subtopic,
    limit: 4,
  });

  const clearMessages = () => {
    setErrors([]);
    setSuccess(null);
    setPreview(null);
    setDiagnostics(null);
  };

  const handleFile = async (file: File) => {
    clearMessages();
    try {
      const text = await file.text();
      const { getQuestionBank, saveQuestionBank } = await import(
        "@/services/question-bank-service"
      );
      const selectedFormat = file.name.toLowerCase().endsWith(".csv")
        ? "csv"
        : format;
      const result = importQuestionsFromText(text, getQuestionBank(), {
        format: selectedFormat,
        allowPartial,
      });
      if (!result.success) {
        setErrors(result.errors);
        setDiagnostics(result.diagnostics ?? null);
        return;
      }
      saveQuestionBank(result.merged);
      const { awaitRepositoryPersist } = await import(
        "@/lib/repositories/await-persist"
      );
      await awaitRepositoryPersist();
      setPreview(result.metadataPreview ?? null);
      setDiagnostics(result.diagnostics ?? null);
      setErrors(result.errors);
      setSuccess(`Imported ${result.questions.length} question(s) successfully.`);
      onImported();
    } catch {
      setErrors([
        { index: -1, message: "Invalid file. Check format and try again." },
      ]);
    }
  };

  const handleManualImport = () => {
    clearMessages();
    void (async () => {
      const raw = {
        ...manual,
        examYear: manual.examYear ? Number(manual.examYear) : undefined,
        marks: 4,
        negativeMarks: manual.questionType === "NUMERICAL" ? 0 : 1,
        difficulty: manual.difficultyLevel,
        sourceType: "PYQ",
        options:
          manual.questionType === "NUMERICAL"
            ? []
            : [
                { label: "A", text: manual.optionA },
                { label: "B", text: manual.optionB },
                { label: "C", text: manual.optionC },
                { label: "D", text: manual.optionD },
              ].filter((option) => option.text.trim()),
        solution: manual.solutionShort,
      };
      const parsed = parseAndValidateManualQuestion(raw);
      if (!parsed.success) {
        setErrors(parsed.errors);
        setDiagnostics(parsed.diagnostics ?? null);
        return;
      }
      const { getQuestionBank, saveQuestionBank } = await import(
        "@/services/question-bank-service"
      );
      const byId = new Map(getQuestionBank().map((question) => [question.id, question]));
      parsed.questions.forEach((question) => byId.set(question.id, question));
      saveQuestionBank([...byId.values()]);
      const { awaitRepositoryPersist } = await import(
        "@/lib/repositories/await-persist"
      );
      await awaitRepositoryPersist();
      setPreview(parsed.metadataPreview ?? null);
      setDiagnostics(parsed.diagnostics ?? null);
      setSuccess("Imported 1 manually entered question.");
      onImported();
    })();
  };

  return (
    <div className="rounded border border-gray-300 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">
        PYQ ingestion
      </h3>
      <p className="mb-3 text-xs text-gray-600">
        Upload CSV/JSON with shape{" "}
        <code className="rounded bg-gray-100 px-1">
          {`{ "questions": [ ... ] }`}
        </code>{" "}
        including exam source, year, taxonomy tags, and solution fields when
        available.
      </p>
      <div className="mb-3 grid gap-3 sm:grid-cols-[160px_1fr]">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Format</Label>
          <select
            className="h-9 w-full rounded border border-input bg-transparent px-2 text-sm"
            value={format}
            onChange={(e) => setFormat(e.target.value as QuestionImportFormat)}
          >
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
        </div>
        <label className="flex items-end gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={allowPartial}
            onChange={(e) => setAllowPartial(e.target.checked)}
          />
          Import valid rows and report invalid rows
        </label>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
      >
        Upload PYQ File
      </Button>

      <div className="mt-4 rounded border border-gray-100 bg-gray-50 p-3">
        <p className="mb-3 text-xs font-semibold uppercase text-gray-500">
          Structured manual entry
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniField label="Subject">
            <Input value={manual.subject} onChange={(e) => setManual((m) => ({ ...m, subject: e.target.value }))} />
          </MiniField>
          <MiniField label="Chapter">
            <Input value={manual.chapter} onChange={(e) => setManual((m) => ({ ...m, chapter: e.target.value }))} />
            <SuggestionRow values={suggestions.chapters.map((s) => s.value)} onPick={(value) => setManual((m) => ({ ...m, chapter: value }))} />
          </MiniField>
          <MiniField label="Topic">
            <Input value={manual.topic} onChange={(e) => setManual((m) => ({ ...m, topic: e.target.value }))} />
            <SuggestionRow values={suggestions.topics.map((s) => s.value)} onPick={(value) => setManual((m) => ({ ...m, topic: value }))} />
          </MiniField>
          <MiniField label="Subtopic">
            <Input value={manual.subtopic} onChange={(e) => setManual((m) => ({ ...m, subtopic: e.target.value }))} />
            <SuggestionRow values={suggestions.subtopics.map((s) => s.value)} onPick={(value) => setManual((m) => ({ ...m, subtopic: value }))} />
          </MiniField>
          <MiniField label="Exam year">
            <Input value={manual.examYear} onChange={(e) => setManual((m) => ({ ...m, examYear: e.target.value }))} />
          </MiniField>
          <MiniField label="Type">
            <select className="h-9 w-full rounded border border-input bg-white px-2 text-sm" value={manual.questionType} onChange={(e) => setManual((m) => ({ ...m, questionType: e.target.value }))}>
              <option value="MCQ_SINGLE">MCQ</option>
              <option value="NUMERICAL">Numerical</option>
            </select>
          </MiniField>
        </div>
        <div className="mt-3 grid gap-3">
          <MiniField label="Question">
            <Input value={manual.questionText} onChange={(e) => setManual((m) => ({ ...m, questionText: e.target.value }))} />
          </MiniField>
          {manual.questionType === "MCQ_SINGLE" && (
            <div className="grid gap-2 sm:grid-cols-4">
              {(["A", "B", "C", "D"] as const).map((label) => (
                <Input
                  key={label}
                  placeholder={`Option ${label}`}
                  value={manual[`option${label}`]}
                  onChange={(e) => setManual((m) => ({ ...m, [`option${label}`]: e.target.value }))}
                />
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
            <MiniField label="Answer">
              <Input value={manual.correctAnswer} onChange={(e) => setManual((m) => ({ ...m, correctAnswer: e.target.value }))} />
            </MiniField>
            <MiniField label="Short solution">
              <Input value={manual.solutionShort} onChange={(e) => setManual((m) => ({ ...m, solutionShort: e.target.value }))} />
            </MiniField>
          </div>
          <Button type="button" variant="outline" onClick={handleManualImport}>
            Import Manual Question
          </Button>
        </div>
      </div>

      {success && (
        <Alert className="mt-3 border-green-300 bg-green-50">
          <AlertTitle>Import successful</AlertTitle>
          <AlertDescription>
            <p>{success}</p>
            {preview && (
              <div className="mt-2 grid gap-1 text-xs text-green-900 sm:grid-cols-2">
                <span>Tagged: {preview.taggedQuestions}/{preview.totalQuestions}</span>
                <span>
                  Solutions: {preview.solutionReadyQuestions}/{preview.totalQuestions}
                </span>
                <span>Sources: {Object.keys(preview.byExamSource).join(", ")}</span>
                <span>Years: {Object.keys(preview.byYear).join(", ")}</span>
              </div>
            )}
            {diagnostics && (
              <p className="mt-2 text-xs text-green-900">
                Rows: {diagnostics.validRows} valid, {diagnostics.invalidRows} invalid,
                {diagnostics.partialImport ? " partial import applied" : " full import"}.
              </p>
            )}
          </AlertDescription>
        </Alert>
      )}

      {errors.length > 0 && (
        <Alert className="mt-3 border-red-300 bg-red-50" variant="destructive">
          <AlertTitle>Import failed ({errors.length} issues)</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 max-h-40 list-inside list-disc overflow-y-auto text-xs">
              {errors.map((err, i) => (
                <li key={`${err.index}-${i}`}>
                  {err.index >= 0 ? `Row ${err.index + 1}` : "File"}
                  {err.field ? ` · ${err.field}` : ""}: {err.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function MiniField({
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

function SuggestionRow({
  values,
  onPick,
}: {
  values: string[];
  onPick: (value: string) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          className="rounded bg-white px-1.5 py-0.5 text-[10px] text-gray-600 ring-1 ring-gray-200"
          onClick={() => onPick(value)}
        >
          {value}
        </button>
      ))}
    </div>
  );
}
