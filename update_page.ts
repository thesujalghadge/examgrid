import fs from "fs";

let content = fs.readFileSync("src/app/student/tests/[testId]/page.tsx", "utf-8");

const oldImports = `import {
  canCandidateAccessExam,
  isOperationalSchedulingActive,
} from "@/services/institute-ops-service";`;

const newImports = `import {
  canCandidateAccessExam,
  isOperationalSchedulingActive,
  getActiveScheduleForRoll,
} from "@/services/institute-ops-service";
import { loadExamAttempt } from "@/lib/persistence";`;

content = content.replace(oldImports, newImports);

const oldCheck = `    const examDef = getExamById(testId);
    if (
      !examDef ||
      !ensureExamReadyForCbt(examDef) ||
      (isOperationalSchedulingActive() && !canCandidateAccessExam(candidate, testId))
    ) {
      setAllowed(false);
      return;
    }`;

const newCheck = `    const examDef = getExamById(testId);
    if (
      !examDef ||
      !ensureExamReadyForCbt(examDef) ||
      (isOperationalSchedulingActive() && !canCandidateAccessExam(candidate, testId))
    ) {
      setAllowed(false);
      return;
    }

    const activeSchedule = getActiveScheduleForRoll(testId, candidate.rollNumber);
    if (activeSchedule) {
      const existing = loadExamAttempt(testId, candidate.rollNumber);
      const isLate = Date.now() > new Date(activeSchedule.startAt).getTime() + 10 * 60 * 1000;
      if (!existing && isLate) {
        setAllowed(false);
        return;
      }
    }`;

content = content.replace(oldCheck, newCheck);

const oldDenied = `  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-200 p-4">
        <p className="text-sm text-gray-700">You cannot access this test.</p>
        <Button variant="outline" onClick={() => router.replace("/student/tests")}>
          Back
        </Button>
      </div>
    );
  }`;

const newDenied = `  if (!allowed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-200 p-4">
        <p className="text-sm text-gray-700 font-medium">You cannot access this test.</p>
        <p className="text-xs text-gray-500 max-w-sm text-center">
          The window to join this exam has closed. Students must start the exam within 10 minutes of the scheduled start time.
        </p>
        <Button variant="outline" onClick={() => router.replace("/student/tests")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }`;
content = content.replace(oldDenied, newDenied);

fs.writeFileSync("src/app/student/tests/[testId]/page.tsx", content);
console.log("Updated page.tsx");
