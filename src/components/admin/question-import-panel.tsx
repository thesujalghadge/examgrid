"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  importQuestionsFromJson,
  type ImportValidationError,
} from "@/services/question-import-service";

interface QuestionImportPanelProps {
  onImported: () => void;
}

export function QuestionImportPanel({ onImported }: QuestionImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<ImportValidationError[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setErrors([]);
    setSuccess(null);
    try {
      const text = await file.text();
      const json: unknown = JSON.parse(text);
      const { getQuestionBank, saveQuestionBank } = await import(
        "@/services/question-bank-service"
      );
      const result = importQuestionsFromJson(json, getQuestionBank());
      if (!result.success) {
        setErrors(result.errors);
        return;
      }
      saveQuestionBank(result.merged);
      const { awaitRepositoryPersist } = await import(
        "@/lib/repositories/await-persist"
      );
      await awaitRepositoryPersist();
      setSuccess(`Imported ${result.questions.length} question(s) successfully.`);
      onImported();
    } catch {
      setErrors([
        { index: -1, message: "Invalid JSON file. Check format and try again." },
      ]);
    }
  };

  return (
    <div className="rounded border border-gray-300 bg-white p-4">
      <h3 className="mb-2 text-sm font-semibold text-gray-900">
        Import questions (JSON)
      </h3>
      <p className="mb-3 text-xs text-gray-600">
        Upload a file with shape{" "}
        <code className="rounded bg-gray-100 px-1">
          {`{ "questions": [ ... ] }`}
        </code>
      </p>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
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
        Upload JSON
      </Button>

      {success && (
        <Alert className="mt-3 border-green-300 bg-green-50">
          <AlertTitle>Import successful</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
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
