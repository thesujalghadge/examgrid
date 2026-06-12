import fs from "fs";

let content = fs.readFileSync("src/components/student/student-cbt-test-list.tsx", "utf-8");

content = content.replace(
  'import { listAssignedCbtTests } from "@/services/cbt-test-service";',
  'import { listAssignedExams } from "@/services/cbt-test-service";'
);

content = content.replace(
  'import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";',
  'import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";\nimport { hydrateSupabaseRepositories } from "@/lib/supabase/hydrate-repositories";'
);

content = content.replace(
  'const timer = window.setInterval(() => setTick((value) => value + 1), 15000);',
  `const timer = window.setInterval(() => {
      hydrateSupabaseRepositories().finally(() => {
        setTick((value) => value + 1);
      });
    }, 15000);`
);

const oldUseMemo = `  const rows = useMemo(() => {
    void tick;
    if (!candidate) return [];
    const repos = getRepositories();
    const student = findStudentForCandidate(candidate);
    const latestByTestId = new Map(
      repos.cbtAttempts
        .listByStudentId(candidate.rollNumber)
        .map((record) => [record.attempt.testId, record]),
    );
    const tests = repos.cbtTests.list();
    const schedules = repos.schedules.list();
    const assigned = listAssignedCbtTests(student, tests, schedules).filter(
      ({ test, schedule }) =>
        (!instituteId || test.instituteId === instituteId) &&
        (!schedule.instituteId || !instituteId || schedule.instituteId === instituteId),
    );

    return assigned.map((row) => {
      const latestAttempt = latestByTestId.get(row.test.id);
      const hasSubmitted = Boolean(latestAttempt?.attempt.submittedAt);
      const hasInProgress =
        !hasSubmitted && Boolean(repos.attempts.load(row.test.id, candidate.rollNumber));
      return { ...row, hasSubmitted, hasInProgress };
    });
  }, [candidate, instituteId, tick]);`;

const newUseMemo = `  const rows = useMemo(() => {
    void tick;
    if (!candidate) return [];
    const repos = getRepositories();
    const student = findStudentForCandidate(candidate);
    const latestByTestId = new Map(
      repos.cbtAttempts
        .listByStudentId(candidate.rollNumber)
        .map((record) => [record.attempt.testId, record]),
    );
    const exams = repos.exams.list();
    const schedules = repos.schedules.list();
    const assigned = listAssignedExams(student, exams, schedules).filter(
      ({ schedule }) =>
        (!schedule.instituteId || !instituteId || schedule.instituteId === instituteId),
    );

    return assigned.map((row) => {
      const latestAttempt = latestByTestId.get(row.exam.id);
      const hasSubmitted = Boolean(latestAttempt?.attempt.submittedAt);
      const hasInProgress =
        !hasSubmitted && Boolean(repos.attempts.load(row.exam.id, candidate.rollNumber));
      return { ...row, test: { id: row.exam.id, title: row.exam.title, durationMinutes: row.exam.durationMinutes, questions: Object.keys(row.exam.questions) }, hasSubmitted, hasInProgress };
    });
  }, [candidate, instituteId, tick]);`;

content = content.replace(oldUseMemo.replace(/\r\n/g, '\n'), newUseMemo);
content = content.replace(oldUseMemo, newUseMemo);

fs.writeFileSync("src/components/student/student-cbt-test-list.tsx", content);
console.log("File updated");
