import { preparedMetaToBankQuestion } from "@/lib/cbt/paper-processing";
import type { ProcessedPaperPackage } from "@/types/cbt-paper-processing";
import type { CBTTest, CBTTestQuestion, CBTTestSection } from "@/types/cbt";
import type { ExamDefinition } from "@/types/exam";
import type { BankQuestion } from "@/types/question-bank";

export function buildCbtTestFromProcessedPaper(
  pkg: ProcessedPaperPackage,
  testId: string,
  batchIds: string[],
  createdBy: string,
  examType: ExamDefinition["examType"] = "JEE_MAIN",
  createdAt = Date.now(),
): { test: CBTTest; bankQuestions: BankQuestion[] } {
  const bankQuestions: BankQuestion[] = [];
  const sections: CBTTestSection[] = [];
  const questions: CBTTestQuestion[] = [];
  let qIndex = 0;

  pkg.sections.forEach((section, sectionIndex) => {
    const sectionId = `${testId}-${section.id}`;
    sections.push({
      id: sectionId,
      testId,
      name: section.name,
      order: sectionIndex,
    });

    section.questions.forEach((meta) => {
      qIndex += 1;
      const bankQ = preparedMetaToBankQuestion(meta, pkg.id);
      bankQuestions.push(bankQ);
      questions.push({
        id: `${testId}-row-${qIndex}`,
        testId,
        sectionId,
        questionId: `${testId}-question-${qIndex}`,
        source: "bank",
        bankQuestionId: bankQ.id,
        questionType: bankQ.questionType,
        marks: bankQ.marks,
        negativeMarks: bankQ.negativeMarks,
      });
    });
  });

  const test: CBTTest = {
    id: testId,
    title: pkg.title,
    instituteId: pkg.instituteId,
    examType,
    durationMinutes: pkg.durationMinutes,
    totalMarks: pkg.totalMarks,
    createdBy,
    sections,
    questions,
    batchIds,
    createdAt,
    updatedAt: createdAt,
    instructions: pkg.instructions,
    sourceFileName: pkg.paperFileName,
    sourceFileType: pkg.paperFileType,
    sourceImportedAt: pkg.preparedAt,
  };
  return { test, bankQuestions };
}


