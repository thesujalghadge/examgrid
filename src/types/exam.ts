export type QuestionPaletteStatus =
  | "not-visited"
  | "not-answered"
  | "answered"
  | "marked-for-review"
  | "answered-and-marked";

export type QuestionType = "MCQ_SINGLE" | "NUMERICAL";

export type ExamViolationType =
  | "tab_switch"
  | "window_blur"
  | "fullscreen_exit"
  | "browser_back";

export interface ExamViolation {
  id: string;
  type: ExamViolationType;
  timestamp: number;
}

export interface ExamOption {
  id: string;
  label: string;
  text: string;
}

export interface ExamQuestion {
  id: string;
  sectionId: string;
  number: number;
  type: QuestionType;
  subject?: string;
  chapter?: string;
  topic?: string;
  subtopic?: string;
  difficultyLevel?: "easy" | "medium" | "hard";
  estimatedSolveTimeSeconds?: number;
  conceptTags?: string[];
  mistakeTags?: string[];
  archetypeKey?: string;
  text: string;
  options: ExamOption[];
  correctOptionId?: string;
  correctNumericalAnswer?: string;
  marks: number;
  negativeMarks: number;
}

export interface ExamSection {
  id: string;
  name: string;
  questionIds: string[];
}

export interface ExamDefinition {
  id: string;
  title: string;
  subtitle: string;
  examType: "JEE_MAIN" | "NEET" | "CET";
  durationMinutes: number;
  totalQuestions: number;
  sections: ExamSection[];
  questions: Record<string, ExamQuestion>;
  instructions: string[];
  scheduledAt: string;
}

export interface Candidate {
  name: string;
  rollNumber: string;
  applicationNumber: string;
  studentId?: string;
  batchId?: string;
  courseType?: string;
}

export type ExamLifecyclePhase =
  | "idle"
  | "instructions_viewed"
  | "declaration_signed"
  | "in_progress"
  | "submitted";

export interface SectionScore {
  sectionId: string;
  sectionName: string;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  score: number;
}

export interface AcademicPerformanceBreakdown {
  name: string;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  accuracy: number;
  averageSolveTimeSeconds?: number;
  score?: number;
}

export interface TopicAnalysis extends AcademicPerformanceBreakdown {
  subject: string;
  chapter: string;
  topic: string;
}

export interface ResultAcademicInsights {
  topicAnalysis: TopicAnalysis[];
  subjectBreakdown: AcademicPerformanceBreakdown[];
  difficultyBreakdown: AcademicPerformanceBreakdown[];
  chapterBreakdown: AcademicPerformanceBreakdown[];
  archetypeWeaknesses: AcademicPerformanceBreakdown[];
  chapterTrends: AcademicPerformanceBreakdown[];
  topicMasteryProgression: TopicAnalysis[];
  mistakePatterns: AcademicPerformanceBreakdown[];
  weakAreas: TopicAnalysis[];
  strongestTopics: TopicAnalysis[];
  suggestedRevisionTopics: string[];
  averageSolveTimeSeconds: number;
}

export interface ExamResult {
  examId: string;
  examTitle: string;
  candidateName: string;
  rollNumber: string;
  submittedAt: number;
  durationUsedSeconds: number;
  totalQuestions: number;
  attempted: number;
  correct: number;
  incorrect: number;
  unattempted: number;
  totalScore: number;
  maxScore: number;
  sectionScores: SectionScore[];
  academicInsights?: ResultAcademicInsights;
  violationCount?: number;
}

export interface PersistedExamAttempt {
  version: 1;
  examId: string;
  candidateRoll: string;
  lifecycle: ExamLifecyclePhase;
  examEndsAt: number;
  startedAt: number;
  currentQuestionId: string;
  currentSectionId: string;
  answers: Record<string, string | null>;
  visited: Record<string, boolean>;
  markedForReview: Record<string, boolean>;
  violations?: ExamViolation[];
  submittedAt?: number;
  result?: ExamResult;
}
