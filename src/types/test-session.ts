export type TestSessionStatus = "in_progress" | "submitted" | "auto_submitted";

export type TestSessionIntegrityEventType =
  | "tab_switch"
  | "fullscreen_exit"
  | "window_blur"
  | "copy_attempt"
  | "paste_attempt"
  | "rapid_navigation"
  | "browser_back";

export interface TestSessionIntegrityEvent {
  type: TestSessionIntegrityEventType;
  at: number;
  meta?: Record<string, string | number>;
}

/** Compact key for server-side scoring verification. */
export interface TestAnswerKeyEntry {
  type: "MCQ_SINGLE" | "NUMERICAL";
  correctOptionId?: string;
  correctNumericalAnswer?: string;
  marks: number;
  negativeMarks: number;
}

export type TestAnswerKey = Record<string, TestAnswerKeyEntry>;

export interface TestQuestionResult {
  questionId: string;
  selected: string | null;
  correct: boolean;
  marksAwarded: number;
  maxMarks: number;
}

export interface TestResultBreakdown {
  correct: number;
  incorrect: number;
  unattempted: number;
  attempted: number;
  maxScore: number;
  rawScore: number;
  integrityPenalty: number;
  finalScore: number;
  durationSeconds: number;
  perQuestion: TestQuestionResult[];
}

export interface TestSession {
  id: string;
  studentId: string;
  testId: string;
  instituteId: string;
  status: TestSessionStatus;
  startedAt: number;
  endsAt: number;
  /** Loaded merged from split storage; omitted on lean saves. */
  answers?: Record<string, string | null>;
  lastSavedAt: number;
  currentQuestionId?: string;
  currentSectionId?: string;
  markedForReview?: Record<string, boolean>;
  visited?: Record<string, boolean>;
  questionOrder: string[];
  optionOrderMap: Record<string, number[]>;
  integrityEvents?: TestSessionIntegrityEvent[];
  integrityScore?: number;
  flagged?: boolean;
  score?: number;
  resultBreakdown?: TestResultBreakdown;
  answerKey?: TestAnswerKey;
  signedAnswerKey?: string;
}

export interface TestSessionTimerClaims {
  testId: string;
  studentId: string;
  instituteId: string;
  startedAt: number;
  endsAt: number;
  sessionId: string;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName?: string;
  score: number;
  maxScore: number;
  durationSeconds: number;
  flagged: boolean;
}

export interface TestAnalytics {
  testId: string;
  attemptCount: number;
  completionRate: number;
  averageScore: number;
  averagePercent: number;
  topPerformers: LeaderboardEntry[];
  weakQuestions: {
    questionId: string;
    incorrectRate: number;
    attemptCount: number;
  }[];
}
