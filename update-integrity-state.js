const fs = require('fs');
let file = 'c:/AI/examgrid/src/hooks/useExamGuard.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '  enabled: boolean;',
  '  enabled?: boolean;\n  integrityState?: "ACTIVE" | "SUSPENDED_BY_SYSTEM" | "DISABLED";'
);

code = code.replace(
  '}: UseExamGuardOptions): UseExamGuardResult {',
  '  integrityState = "ACTIVE",\n}: UseExamGuardOptions): UseExamGuardResult {'
);

code = code.replace(
  '  useEffect(() => {\n    if (!enabled) return;\n\n    const handleBeforeUnload = (e: BeforeUnloadEvent) => {',
  '  useEffect(() => {\n    if (integrityState === "DISABLED" && !enabled) return;\n\n    const handleBeforeUnload = (e: BeforeUnloadEvent) => {'
);

code = code.replace(
  '  useEffect(() => {\n    if (!enabled) return;\n\n    if (!guardPushedRef.current) {',
  '  useEffect(() => {\n    if (integrityState === "DISABLED" && !enabled) return;\n\n    if (!guardPushedRef.current) {'
);

code = code.replace(
  '  useEffect(() => {\n    if (!enabled) return;\n\n    const handleVisibility = () => {',
  '  useEffect(() => {\n    if (integrityState !== "ACTIVE" && !enabled) return;\n\n    const handleVisibility = () => {'
);

code = code.replace(
  '  useEffect(() => {\n    if (!enabled) return;\n\n    const handleFullscreenChange = () => {',
  '  useEffect(() => {\n    if (integrityState !== "ACTIVE" && !enabled) return;\n\n    const handleFullscreenChange = () => {'
);

code = code.replace(
  '  useEffect(() => {\n    if (!enabled || lastViolationMessage == null) return;',
  '  useEffect(() => {\n    if ((integrityState === "DISABLED" && !enabled) || lastViolationMessage == null) return;'
);

fs.writeFileSync(file, code);

file = 'c:/AI/examgrid/src/hooks/use-test-session-engine.ts';
code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '  enabled: boolean;',
  '  enabled?: boolean;\n  integrityState?: "ACTIVE" | "SUSPENDED_BY_SYSTEM" | "DISABLED";'
);

code = code.replace(
  '}) {',
  '  integrityState = "ACTIVE",\n}) {'
);

code = code.replace(
  '  useEffect(() => {\n    if (!enabled) return;\n\n    let prevAnswers = useQuestionStore.getState().answers;',
  '  useEffect(() => {\n    if (integrityState === "DISABLED" && !enabled) return;\n\n    let prevAnswers = useQuestionStore.getState().answers;'
);

code = code.replace(
  '    const onVisibility = () => {\n      if (document.visibilityState === "hidden" && sessionRef.current?.status === "in_progress") {',
  '    const onVisibility = () => {\n      if (integrityState !== "ACTIVE") return;\n      if (document.visibilityState === "hidden" && sessionRef.current?.status === "in_progress") {'
);

code = code.replace(
  '    const onBlur = () => {\n      if (document.visibilityState === "visible" && sessionRef.current?.status === "in_progress") {',
  '    const onBlur = () => {\n      if (integrityState !== "ACTIVE") return;\n      if (document.visibilityState === "visible" && sessionRef.current?.status === "in_progress") {'
);

code = code.replace(
  '    const onCopy = (e: ClipboardEvent) => {\n      if (sessionRef.current?.status === "in_progress") {',
  '    const onCopy = (e: ClipboardEvent) => {\n      if (integrityState !== "ACTIVE") return;\n      if (sessionRef.current?.status === "in_progress") {'
);

code = code.replace(
  '    const onPaste = (e: ClipboardEvent) => {\n      if (sessionRef.current?.status === "in_progress") {',
  '    const onPaste = (e: ClipboardEvent) => {\n      if (integrityState !== "ACTIVE") return;\n      if (sessionRef.current?.status === "in_progress") {'
);

code = code.replace(
  '    const onFullscreen = () => {\n      if (\n        !document.fullscreenElement &&\n        sessionRef.current?.status === "in_progress"\n      ) {',
  '    const onFullscreen = () => {\n      if (integrityState !== "ACTIVE") return;\n      if (\n        !document.fullscreenElement &&\n        sessionRef.current?.status === "in_progress"\n      ) {'
);

code = code.replace(
  '  useEffect(() => {\n    if (!enabled) return;',
  '  useEffect(() => {\n    if (integrityState === "DISABLED" && !enabled) return;'
);

fs.writeFileSync(file, code);

file = 'c:/AI/examgrid/src/components/exam/ExamInterface.tsx';
code = fs.readFileSync(file, 'utf8');

code = code.replace(
  '  const isInstituteCbt = !isTeacherReview && Boolean(cbtTest);',
  '  const isInstituteCbt = !isTeacherReview && Boolean(cbtTest);\n\n  const integrityState = (!ready || isTeacherReview) ? "DISABLED" : (showSubmitConfirm || submitState !== "idle" ? "SUSPENDED_BY_SYSTEM" : "ACTIVE");'
);

code = code.replace(
  '  const testEngine = useTestSessionEngine({\n    enabled: isInstituteCbt && Boolean(candidateRollNumber && instituteId),',
  '  const testEngine = useTestSessionEngine({\n    enabled: isInstituteCbt && Boolean(candidateRollNumber && instituteId),\n    integrityState,'
);

code = code.replace(
  '  const guard = useExamGuard({\n    enabled: ready && !isTeacherReview,',
  '  const guard = useExamGuard({\n    enabled: ready && !isTeacherReview,\n    integrityState,'
);

fs.writeFileSync(file, code);

