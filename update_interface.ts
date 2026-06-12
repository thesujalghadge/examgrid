import fs from "fs";

let content = fs.readFileSync("src/components/exam/ExamInterface.tsx", "utf-8");

const oldImports = `import { bootstrapExamSession } from "@/lib/exam-bootstrap";`;
const newImports = `import { bootstrapExamSession, startExamAttempt } from "@/lib/exam-bootstrap";
import { ExamInstructions } from "./ExamInstructions";`;
content = content.replace(oldImports, newImports);

const oldLifecycleAccess = `  const candidateRollNumber = candidate?.rollNumber;`;
const newLifecycleAccess = `  const candidateRollNumber = candidate?.rollNumber;
  const lifecyclePhase = useExamLifecycleStore((s) => s.phase);`;
content = content.replace(oldLifecycleAccess, newLifecycleAccess);

const oldFinishBootstrap = `    const finishBootstrap = (result: ReturnType<typeof bootstrapExamSession>) => {
      if (result.status === "not_found") {
        routerRef.current.replace(navRef.current.unauthorized);
        return;
      }
      if (result.status === "already_submitted") {
        routerRef.current.replace(navRef.current.result(examId));
        return;
      }
      if (result.status === "resumed") {
        setResumed(true);
        setStartedAtRef.current(result.attempt.startedAt);
        if (useTimerStore.getState().getRemainingSeconds() <= 0) {
          setReady(true);
          queueMicrotask(() => finalizeRef.current());
          return;
        }
      } else {
        setStartedAtRef.current(startedAt);
        recordAuditEvent({
          actorId: candidateRollNumber,
          actorRole: "student",
          actionType: "exam_start",
          resourceType: "exam",
          resourceId: examId,
          metadata: { startedAtUTC: new Date(startedAt).toISOString() },
        });
      }
      void requestExamFullscreen();
      setReady(true);
    };`;

const newFinishBootstrap = `    const finishBootstrap = (result: ReturnType<typeof bootstrapExamSession>) => {
      if (result.status === "not_found") {
        routerRef.current.replace(navRef.current.unauthorized);
        return;
      }
      if (result.status === "already_submitted") {
        routerRef.current.replace(navRef.current.result(examId));
        return;
      }
      if (result.status === "resumed") {
        setResumed(true);
        setStartedAtRef.current(result.attempt.startedAt);
        if (useTimerStore.getState().getRemainingSeconds() <= 0) {
          setReady(true);
          queueMicrotask(() => finalizeRef.current());
          return;
        }
        void requestExamFullscreen();
      } else if (result.status === "instructions") {
        setStartedAtRef.current(startedAt);
      } else {
        setStartedAtRef.current(startedAt);
        recordAuditEvent({
          actorId: candidateRollNumber,
          actorRole: "student",
          actionType: "exam_start",
          resourceType: "exam",
          resourceId: examId,
          metadata: { startedAtUTC: new Date(startedAt).toISOString() },
        });
        void requestExamFullscreen();
      }
      setReady(true);
    };`;
content = content.replace(oldFinishBootstrap.replace(/\r\n/g, '\n'), newFinishBootstrap);
content = content.replace(oldFinishBootstrap, newFinishBootstrap);


const oldRender = `  if (!ready || (!isTeacherReview && (!candidate || !exam))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-200 text-sm text-gray-600">
        Preparing examination...
      </div>
    );
  }

  return (
    <div className={isTeacherReview ? "flex h-full min-h-0 flex-col bg-[#c8d0dc]" : "flex min-h-screen flex-col bg-[#c8d0dc]"}>`;

const newRender = `  if (!ready || (!isTeacherReview && (!candidate || !exam))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-200 text-sm text-gray-600">
        Preparing examination...
      </div>
    );
  }

  if (!isTeacherReview && lifecyclePhase === "instructions_viewed" && exam && candidateRollNumber) {
    return (
      <ExamInstructions 
        exam={exam} 
        onProceed={() => {
          recordAuditEvent({
            actorId: candidateRollNumber,
            actorRole: "student",
            actionType: "exam_start",
            resourceType: "exam",
            resourceId: examId,
            metadata: { startedAtUTC: new Date().toISOString() },
          });
          void requestExamFullscreen();
          startExamAttempt(examId, candidateRollNumber, Date.now());
        }}
      />
    );
  }

  return (
    <div className={isTeacherReview ? "flex h-full min-h-0 flex-col bg-[#c8d0dc]" : "flex min-h-screen flex-col bg-[#c8d0dc]"}>`;
content = content.replace(oldRender.replace(/\r\n/g, '\n'), newRender);
content = content.replace(oldRender, newRender);

fs.writeFileSync("src/components/exam/ExamInterface.tsx", content);
console.log("Updated ExamInterface.tsx");
