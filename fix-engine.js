const fs = require('fs');
const file = 'c:/AI/examgrid/src/hooks/use-test-session-engine.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  `export function useTestSessionEngine({
  enabled,
  testId,
  studentId,
  instituteId,
  durationMinutes,
  onExpired,
  onSubmitted,
  integrityState = "ACTIVE",
  const navTimestampsRef = useRef<number[]>([]);`,
  `export function useTestSessionEngine(params: {
  enabled?: boolean;
  integrityState?: "ACTIVE" | "SUSPENDED_BY_SYSTEM" | "DISABLED";
  testId: string;
  studentId: string;
  instituteId: string;
  durationMinutes: number;
  onExpired?: () => void;
  onSubmitted?: (session: TestSession) => void;
}) {
  const {
    enabled,
    testId,
    studentId,
    instituteId,
    durationMinutes,
    onExpired,
    onSubmitted,
    integrityState = "ACTIVE",
  } = params;

  const sessionRef = useRef<TestSession | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const navTimestampsRef = useRef<number[]>([]);`
);

fs.writeFileSync(file, code);
