import { preparedMetaToBankQuestion } from "@/lib/cbt/paper-processing";
import type { ProcessedPaperPackage } from "@/types/cbt-paper-processing";
import type { CBTTest, CBTTestQuestion, CBTTestSection } from "@/types/cbt";
import type { BankQuestion } from "@/types/question-bank";

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function buildCbtTestFromProcessedPaper(
  pkg: ProcessedPaperPackage,
  testId: string,
  batchIds: string[],
  createdBy: string,
  createdAt = Date.now(),
): { test: CBTTest; bankQuestions: BankQuestion[] } {
  const bankQuestions: BankQuestion[] = [];
  const sections: CBTTestSection[] = [];
  const questions: CBTTestQuestion[] = [];
  let order = 0;
  let qIndex = 0;

  pkg.sections.forEach((section, sectionIndex) => {
    const sectionId = `${testId}-${slug(section.name)}`;
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
    order = sectionIndex;
  });

  const test: CBTTest = {
    id: testId,
    title: pkg.title,
    instituteId: pkg.instituteId,
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

  void order;
  return { test, bankQuestions };
}
