"use client";

import { useCallback, useState } from "react";
import { QuestionBankList } from "@/components/admin/question-bank-list";
import { QuestionImportPanel } from "@/components/admin/question-import-panel";
import { getQuestionBank } from "@/services/question-bank-service";
import type { BankQuestion } from "@/types/question-bank";

export default function AdminQuestionsPage() {
  const [questions, setQuestions] = useState<BankQuestion[]>(() =>
    getQuestionBank(),
  );

  const refresh = useCallback(() => {
    setQuestions(getQuestionBank());
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
        <p className="text-sm text-gray-600">
          Import, filter, and manage reusable questions for exam papers.
        </p>
      </div>

      <QuestionImportPanel onImported={refresh} />
      <QuestionBankList questions={questions} />
    </div>
  );
}
