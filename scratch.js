const fs = require('fs');
const file = 'c:/AI/examgrid/src/components/exam/ExamInterface.tsx';
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('const finalizeSubmit = useCallback(async () => {');
const endIdx = content.indexOf('useEffect(() => {', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newFinalize = `const finalizeSubmit = useCallback(async () => {
    if (!candidate || !exam) {
      setSubmitState("idle");
      return;
    }

    const previous = loadExamAttempt(examId, candidate.rollNumber);
    const lifecyclePhase = useExamLifecycleStore.getState().phase;

    if (
      !canSubmitExam({
        lifecyclePhase,
        submitInProgress: submitInProgressRef.current,
        existingAttempt: previous,
      })
    ) {
      logCbtGuard("submit blocked - duplicate or already submitted");
      if (previous?.lifecycle === "submitted") {
        await exitFullscreenBeforeRedirect();
        router.replace(nav.result(examId));
      } else {
        setSubmitState("idle");
      }
      return;
    }

    submitInProgressRef.current = true;
    setSubmitState("submitting");

    if (isInstituteCbt) {
      testEngine.flushSave();
      let attemptCount = 0;
      let success = false;
      const delays = [2000, 4000, 8000, 16000];

      while (!success && attemptCount <= delays.length) {
        try {
          if (attemptCount > 0) setSubmitState("retrying");
          await testEngine.lockSubmit("submitted");
          success = true;
          setSubmitState("saved");
        } catch (error) {
          if (attemptCount < delays.length) {
            await new Promise((res) => setTimeout(res, delays[attemptCount]));
            attemptCount++;
          } else {
            setSubmitState("failed");
            submitInProgressRef.current = false;
            return;
          }
        }
      }
    } else {
      const qState = useQuestionStore.getState();
      const timerState = useTimerStore.getState();
      timerState.stop();

      const safeCurrentQuestionId =
        qState.currentQuestionId && exam.questions[qState.currentQuestionId]
          ? qState.currentQuestionId
          : Object.keys(exam.questions)[0];

      const safeCurrentSectionId =
        qState.currentSectionId && exam.sections.some((s) => s.id === qState.currentSectionId)
          ? qState.currentSectionId
          : exam.sections[0].id;

      if (!safeCurrentQuestionId) {
        submitInProgressRef.current = false;
        setSubmitState("idle");
        return;
      }

      const sessionViolations = useExamSessionStore.getState().violations;
      const attempt = {
        version: 1,
        examId,
        candidateRoll: candidate.rollNumber,
        lifecycle: "submitted",
        examEndsAt: timerState.examEndsAt ?? Date.now(),
        startedAt: previous?.startedAt ?? Date.now(),
        currentQuestionId: safeCurrentQuestionId,
        currentSectionId: safeCurrentSectionId,
        answers: qState.answers,
        visited: qState.visited,
        markedForReview: qState.markedForReview,
        violations: sessionViolations,
        submittedAt: Date.now(),
      };

      const result = computeExamResult(exam, attempt as any, candidate.name);
      attempt.result = result;
      const saved = saveExamAttempt(attempt as any);
      if (!saved) {
        submitInProgressRef.current = false;
        setSubmitState("idle");
        return;
      }

      setResult(result);
      persistNow();
    }

    logCbtGuard("submit completed", {
      examId,
      candidateRoll: candidate.rollNumber,
    });

    useTimerStore.getState().stop();
    useExamLifecycleStore.getState().setPhase("submitted");
    recordAuditEvent({
      actorId: candidate.rollNumber,
      actorRole: "student",
      actionType: "exam_submit",
      resourceType: "exam",
      resourceId: examId,
      metadata: { serverBacked: isInstituteCbt },
    });

    await exitFullscreenBeforeRedirect();
    router.replace(nav.result(examId));
  }, [candidate, exam, examId, isInstituteCbt, nav, persistNow, router, setResult, testEngine]);\n\n  `;
  
  content = content.substring(0, startIdx) + newFinalize + content.substring(endIdx);
  fs.writeFileSync(file, content);
  console.log('REPLACED SUCCESSFULLY');
} else {
  console.log('INDICES NOT FOUND');
}
