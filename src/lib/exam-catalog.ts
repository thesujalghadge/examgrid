import { cbtTestToExamDefinition } from "@/lib/cbt/cbt-to-exam";
import { getRepositories } from "@/lib/repositories/provider";
import type { ExamDefinition } from "@/types/exam";
import { validateExamStructure } from "@/lib/validation/exam-integrity";
import { logValidationFailure } from "@/lib/logging/runtime-logger";

function filterValidExams(exams: ExamDefinition[]): ExamDefinition[] {
  return exams.filter((exam) => {
    const check = validateExamStructure(exam);
    if (!check.valid) {
      logValidationFailure(`exam:${exam.id}`, check.errors.join("; "));
      return false;
    }
    return true;
  });
}

export function getExamById(examId: string): ExamDefinition | undefined {
  if (typeof window === "undefined") return undefined;
  const cbt = getRepositories().cbtTests.getById(examId);
  if (!cbt) return undefined;
  const definition = cbtTestToExamDefinition(cbt);
  if (!definition) return undefined;
  const valid = filterValidExams([definition]);
  return valid[0];
}
