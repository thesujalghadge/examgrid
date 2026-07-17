"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { getExamById } from "@/lib/exam-catalog";
import { Button } from "@/components/ui/button";
import { verifyAndFetchSolution } from "@/app/student/actions/solution-access";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import SolutionCard from "@/components/student/solution/SolutionCard";
import LegacySolutionRenderer from "@/components/student/solution/LegacySolutionRenderer";
import type { ExamQuestion } from "@/types/exam";
import type { TestQuestionResult, TestResultBreakdown } from "@/types/test-session";
import type { CBTTest } from "@/types/cbt";

// ─── Types ──────────────────────────────────────────────────────────────────

type SolutionPayload = {
  content_markdown?: string;
  final_answer?: string;
  ai_metadata?: Record<string, any>;
};

type AttemptResultPayload = {
  resultBreakdown?: TestResultBreakdown;
};

type SolutionQuestionRow = {
  questionId: string;
  text: string;
  questionImage?: string;
  studentAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
  hasAttempted: boolean;
  timeSpentSeconds: number;
  answerChangedCount: number;
  markedForReview: boolean;
  firstAnswer: string | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </ReactMarkdown>
  );
}

/**
 * Detect prompt version from ai_metadata to route to correct renderer.
 */
function detectPromptVersion(meta: Record<string, any> | undefined): "v3" | "v2" | "v1" {
  if (!meta) return "v1";
  if (meta.promptVersion === "solution-v3" || meta.prompt_version === "solution-v3") return "v3";
  if (meta.prompt_version === "solution-v2-strict" || meta.steps) return "v2";
  return "v1";
}

// ─── Question Solution Card ────────────────────────────────────────────────

function QuestionSolutionCard({
  instituteId,
  testId,
  studentId,
  questionId,
  questionNumber,
  hasAttempted,
  studentAnswer,
  correctAnswer,
  isCorrect,
  questionText,
  questionImage,
  solutionMode,
  timeSpentSeconds,
  answerChangedCount,
  markedForReview,
  firstAnswer,
}: {
  instituteId: string;
  testId: string;
  studentId: string;
  questionId: string;
  questionNumber: number;
  hasAttempted: boolean;
  studentAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
  questionText: string;
  questionImage?: string;
  solutionMode: "EXAM" | "LEARN";
  timeSpentSeconds: number;
  answerChangedCount: number;
  markedForReview: boolean;
  firstAnswer: string | null;
}) {
  const [solution, setSolution] = useState<SolutionPayload | null>(null);
  const [progress, setProgress] = useState<{
    completed: number;
    total: number;
    estimatedMinutes: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const fetchSolution = async () => {
    setLoading(true);
    setError(null);
    setProgress(null);
    const res = await verifyAndFetchSolution(
      instituteId,
      testId,
      studentId,
      questionId,
      hasAttempted
    );
    if (res.error) {
      setError(res.error);
    } else if (res.progress) {
      setProgress(res.progress);
    } else {
      setSolution(res.data ?? null);
    }
    setLoading(false);
  };

  // Auto-load solutions on mount (lazy: Intersection Observer could be added later)
  useEffect(() => {
    if (!autoLoaded) {
      setAutoLoaded(true);
      fetchSolution();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const meta = solution?.ai_metadata;
  const version = detectPromptVersion(meta);
  const cleanQText = questionText.replace(/^Q\d+\.\s*/, "").trim();

  return (
    <div
      id={`q-${questionNumber}`}
      className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md"
    >
      {/* ─── Question Header ─────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 md:px-6">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex-shrink-0 w-9 h-9 rounded-xl text-sm font-bold flex items-center justify-center shadow-sm ${
                isCorrect
                  ? "bg-emerald-500 text-white"
                  : hasAttempted
                    ? "bg-rose-500 text-white"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {questionNumber}
            </span>
            <div>
              <h3 className="font-bold text-slate-900 text-base">
                Question {questionNumber}
              </h3>
              {meta?.topic && (
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {meta.topic}
                  {meta?.subtopic ? ` › ${meta.subtopic}` : ""}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ─── Question Body ───────────────────────────────────────── */}
        <div className="mb-4">
          {questionImage ? (
            <img
              src={questionImage}
              alt={`Question ${questionNumber}`}
              className="max-w-full h-auto object-contain rounded-lg border border-slate-100"
              loading="lazy"
            />
          ) : (
            <div className="text-slate-800 text-[15px] leading-relaxed">
              <Md>{cleanQText}</Md>
            </div>
          )}
        </div>

        {/* ─── Answer Status Bar ───────────────────────────────────── */}
        <div className="flex flex-wrap gap-4 items-center p-3.5 bg-slate-50/80 rounded-xl border border-slate-100">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">
              Your Answer
            </span>
            <span
              className={`text-sm font-bold ${
                isCorrect
                  ? "text-emerald-600"
                  : studentAnswer
                    ? "text-rose-600"
                    : "text-slate-400"
              }`}
            >
              {studentAnswer || "—"}
            </span>
          </div>
          <div className="w-px h-7 bg-slate-200 hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">
              Correct Answer
            </span>
            <span className="text-sm font-bold text-slate-900">
              {correctAnswer || "—"}
            </span>
          </div>
          <div className="w-px h-7 bg-slate-200 hidden sm:block" />
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">
              Time Spent
            </span>
            <span className="text-sm font-bold text-slate-900">
              {timeSpentSeconds}s
            </span>
          </div>
          {answerChangedCount > 0 && (
            <>
              <div className="w-px h-7 bg-slate-200 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">
                  Answer Changes
                </span>
                <span className="text-sm font-bold text-amber-600">
                  {answerChangedCount}
                </span>
              </div>
            </>
          )}
          {markedForReview && (
            <>
              <div className="w-px h-7 bg-slate-200 hidden sm:block" />
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">
                  Review Status
                </span>
                <span className="text-sm font-bold text-indigo-600">
                  Marked
                </span>
              </div>
            </>
          )}
          <div className="ml-auto">
            {isCorrect ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-lg">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                Correct
              </span>
            ) : studentAnswer ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-100 text-rose-800 text-xs font-bold rounded-lg">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Incorrect
              </span>
            ) : (
              <span className="px-3 py-1.5 bg-slate-100 text-slate-500 text-xs font-bold rounded-lg">
                Skipped
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Solution Content ──────────────────────────────────────── */}
      {solution ? (
        <div className="border-t border-slate-100 px-5 py-5 md:px-6">
          {version === "v3" ? (
            <SolutionCard
              meta={meta as any}
              contentMarkdown={solution.content_markdown}
              hasAttempted={hasAttempted}
              studentAnswer={studentAnswer}
              correctAnswer={correctAnswer}
              isCorrect={isCorrect}
              mode={solutionMode}
            />
          ) : (
            <LegacySolutionRenderer
              meta={meta}
              contentMarkdown={solution.content_markdown}
            />
          )}
        </div>
      ) : progress ? (
        <div className="border-t border-amber-100 px-5 py-5 md:px-6 bg-amber-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-amber-600 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Generating solutions...
              </p>
              <p className="text-xs text-amber-700">
                {progress.completed}/{progress.total} complete · ~{progress.estimatedMinutes} min remaining
              </p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-amber-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{
                width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
          <Button
            variant="outline"
            className="mt-3 text-xs border-amber-200 text-amber-800 hover:bg-amber-50"
            onClick={fetchSolution}
            disabled={loading}
          >
            {loading ? "Checking..." : "Refresh"}
          </Button>
        </div>
      ) : error ? (
        <div className="border-t border-rose-100 px-5 py-4 md:px-6 bg-rose-50/50">
          <p className="text-sm text-rose-700 font-medium">{error}</p>
        </div>
      ) : (
        <div className="border-t border-slate-100 px-5 py-5 md:px-6 bg-slate-50/50 flex justify-center">
          <Button
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8 py-2.5 rounded-xl transition-colors text-sm"
            onClick={fetchSolution}
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Loading...
              </span>
            ) : (
              "Show Solution"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Question Navigation Sidebar ────────────────────────────────────────────

function QuestionNav({
  questions,
  currentQuestion,
  onJump,
}: {
  questions: SolutionQuestionRow[];
  currentQuestion: number;
  onJump: (idx: number) => void;
}) {
  return (
    <div className="hidden lg:block sticky top-20 w-16">
      <div className="flex flex-col gap-1.5 p-2 bg-white/80 backdrop-blur-sm rounded-xl border border-slate-200/60 shadow-sm">
        {questions.map((q, idx) => (
          <button
            key={q.questionId}
            onClick={() => onJump(idx)}
            className={`w-10 h-10 rounded-lg text-xs font-bold transition-all duration-150 ${
              q.isCorrect
                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                : q.hasAttempted
                  ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            } ${currentQuestion === idx ? "ring-2 ring-indigo-500 ring-offset-1" : ""}`}
            title={`Question ${idx + 1}`}
          >
            {idx + 1}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StudentSolutionsPage() {
  const params = useParams();
  const testId = params.testId as string;
  const router = useRouter();

  const candidate = useAuthStore((s) => s.candidate);
  const ws = useWorkspaceAuthStore((s) => s.session);

  const [attemptData, setAttemptData] = useState<
    AttemptResultPayload | null | undefined
  >(undefined);
  const [testData, setTestData] = useState<CBTTest | null>(null);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [activeQuestion, setActiveQuestion] = useState(0);
  const [solutionMode, setSolutionMode] = useState<"EXAM" | "LEARN">("EXAM");
  const [modeStartTime, setModeStartTime] = useState<number>(Date.now());

  // Load persisted mode
  useEffect(() => {
    const saved = localStorage.getItem("examgrid_solution_mode");
    if (saved === "EXAM" || saved === "LEARN") {
      setSolutionMode(saved);
    }
  }, []);

  const exam = getExamById(testId);

  const trackModeSwitch = (newMode: "EXAM" | "LEARN", previousMode: "EXAM" | "LEARN") => {
    if (newMode === previousMode) return;
    
    const now = Date.now();
    const timeInPreviousMode = now - modeStartTime;
    setModeStartTime(now);
    
    // Find active question details if exam data is loaded
    let questionId = "unknown";
    let difficulty = "unknown";
    
    if (exam) {
      const allQuestionIds = exam.sections.flatMap(s => s.questionIds);
      if (allQuestionIds[activeQuestion]) {
        questionId = allQuestionIds[activeQuestion];
        const qData = exam.questions[questionId];
        difficulty = (qData as any)?.difficulty || "unknown";
      }
    }
    
    const payload = {
      questionId,
      previousMode,
      newMode,
      timeInPreviousMode,
      difficulty
    };
    
    console.log("Analytics Event: Mode Switch", payload);
    // TODO: Send to backend /telemetry endpoint
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      
      setSolutionMode((prevMode) => {
        if (e.key.toLowerCase() === "e" && prevMode !== "EXAM") {
          trackModeSwitch("EXAM", prevMode);
          localStorage.setItem("examgrid_solution_mode", "EXAM");
          return "EXAM";
        } else if (e.key.toLowerCase() === "l" && prevMode !== "LEARN") {
          trackModeSwitch("LEARN", prevMode);
          localStorage.setItem("examgrid_solution_mode", "LEARN");
          return "LEARN";
        }
        return prevMode;
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeQuestion, modeStartTime, exam]);

  const handleModeSwitch = (mode: "EXAM" | "LEARN") => {
    if (mode !== solutionMode) {
      trackModeSwitch(mode, solutionMode);
      setSolutionMode(mode);
      localStorage.setItem("examgrid_solution_mode", mode);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!candidate || !ws?.instituteId) {
      router.replace("/student/login");
      return;
    }

    fetch(
      `/api/cbt/test-session/result?testId=${encodeURIComponent(testId)}`,
      {
        credentials: "include",
        cache: "no-store",
      }
    )
      .then(async (res) => {
        if (res.status === 404) return null;
        if (!res.ok) throw new Error("Could not load submitted attempt.");
        return res.json();
      })
      .then((data: AttemptResultPayload | null) => setAttemptData(data))
      .catch((err) => {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load submitted attempt."
        );
      });
  }, [candidate, ws, testId, router]);

  const handleJumpToQuestion = useCallback((idx: number) => {
    setActiveQuestion(idx);
    const el = document.getElementById(`q-${idx + 1}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fa] p-6 text-center">
        <p className="text-sm text-slate-500">{error}</p>
        <Button
          variant="outline"
          className="border-slate-300"
          onClick={() =>
            router.push(`/student/tests/${testId}/result`)
          }
        >
          Back to Result
        </Button>
      </div>
    );
  }


  if (attemptData === undefined || !ws?.instituteId || !candidate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-8 h-8 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-slate-500 font-medium">Loading solutions...</p>
        </div>
      </div>
    );
  }

  const breakdown = attemptData?.resultBreakdown as
    | TestResultBreakdown
    | undefined;
  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500 bg-[#f8f9fa]">
        Exam data could not be loaded.
      </div>
    );
  }

  const releaseMs = exam.solutionsReleaseTime
    ? new Date(exam.solutionsReleaseTime).getTime()
    : 0;
  const isReleased = releaseMs === 0 || currentTime >= releaseMs;

  if (!isReleased) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fa] p-6 text-center">
        <div className="max-w-md w-full rounded-2xl border border-slate-200 bg-white shadow-sm p-8">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            Solutions Not Yet Available
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Solutions will be released at:
          </p>
          <p className="text-lg font-bold text-slate-900 mb-6">
            {new Date(releaseMs).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
          <Button
            variant="outline"
            className="w-full border-slate-300"
            onClick={() =>
              router.push(`/student/tests/${testId}/result`)
            }
          >
            Back to Result
          </Button>
        </div>
      </div>
    );
  }

  const resultByQuestion = new Map(
    breakdown?.perQuestion?.map((row: TestQuestionResult) => [
      row.questionId,
      row,
    ]) ?? []
  );

  const answerLabel = (
    question: ExamQuestion,
    answer: string | null | undefined
  ) => {
    if (!answer) return null;
    if (question.type === "NUMERICAL" || question.type === "INTEGER")
      return answer;

    if (answer.includes(",")) {
      return answer
        .split(",")
        .map((ans) => {
          const opt = question.options.find((o) => o.id === ans);
          return opt ? `Option ${opt.label}` : ans;
        })
        .sort()
        .join(", ");
    }

    const opt = question.options.find((o) => o.id === answer);
    return opt ? `Option ${opt.label}` : answer;
  };

  const correctLabel = (question: ExamQuestion) => {
    if (question.type === "NUMERICAL" || question.type === "INTEGER")
      return question.correctNumericalAnswer ?? null;
    if (!question.correctOptionId) return null;

    if (question.correctOptionId.includes(",")) {
      return question.correctOptionId
        .split(",")
        .map((ans) => {
          const opt = question.options.find((o) => o.id === ans);
          if (opt) return `Option ${opt.label}`;
          const labelMap: Record<string, string> = {
            A: "Option A",
            B: "Option B",
            C: "Option C",
            D: "Option D",
          };
          return labelMap[ans] ?? ans;
        })
        .sort()
        .join(", ");
    }

    const opt = question.options.find(
      (o) => o.id === question.correctOptionId
    );
    if (opt) return `Option ${opt.label}`;

    const labelMap: Record<string, string> = {
      A: "Option A",
      B: "Option B",
      C: "Option C",
      D: "Option D",
    };
    return labelMap[question.correctOptionId] ?? question.correctOptionId;
  };

  const questions: SolutionQuestionRow[] = exam.sections
    .flatMap((section) => section.questionIds)
    .map((questionId) => {
      const question = exam.questions[questionId];
      const response = resultByQuestion.get(questionId);
      const questionImage =
        question?.stemImage ||
        (question?.images && question.images.length > 0
          ? question.images[0]
          : undefined);

      return {
        questionId,
        text: question?.text || "Question text unavailable",
        questionImage,
        studentAnswer: question
          ? answerLabel(question, response?.selected)
          : null,
        correctAnswer: question ? correctLabel(question) : null,
        isCorrect: response?.correct ?? false,
        hasAttempted: Boolean(response?.selected),
        timeSpentSeconds: response?.timeSpentSeconds ?? 0,
        answerChangedCount: response?.answerChangedCount ?? 0,
        markedForReview: response?.markedForReview ?? false,
        firstAnswer: response?.firstAnswer ?? null,
      };
    });

  // Stats
  const correctCount = questions.filter((q) => q.isCorrect).length;
  const attemptedCount = questions.filter((q) => q.hasAttempted).length;
  const incorrectCount = attemptedCount - correctCount;
  const skippedCount = questions.length - attemptedCount;

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* ─── Sticky Header ─────────────────────────────────────────── */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sticky top-0 z-20">
        <div>
          <h1 className="text-lg font-bold text-slate-900">Solutions Review</h1>
          <p className="text-xs text-slate-500 font-medium">{exam.title}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Score summary pills */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700">
              ✓ {correctCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700">
              ✗ {incorrectCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500">
              ○ {skippedCount}
            </span>
          </div>
          <Button
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs h-8 px-3"
            onClick={() =>
              router.push(`/student/tests/${testId}/result`)
            }
          >
            ← Result
          </Button>
        </div>
      </header>

      {/* ─── Mode Toggle (Sticky below header) ───────────────────────── */}
      <div className="sticky top-[68px] sm:top-[72px] z-10 bg-[#f8f9fa]/95 backdrop-blur-md border-b border-slate-200/50 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex justify-center">
          <div className="flex bg-slate-200/70 p-1 rounded-xl shadow-inner">
            <button
              onClick={() => handleModeSwitch("EXAM")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                solutionMode === "EXAM"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <span>⚡</span>
              <span>Exam Strategy</span>
              <span className="hidden sm:inline-block ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200">E</span>
            </button>
            <button
              onClick={() => handleModeSwitch("LEARN")}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${
                solutionMode === "LEARN"
                  ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-900/5"
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
              }`}
            >
              <span>📘</span>
              <span>Concept Breakdown</span>
              <span className="hidden sm:inline-block ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-400 border border-slate-200">L</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Main Content ──────────────────────────────────────────── */}
      <div className="flex gap-4 max-w-5xl mx-auto p-4 sm:p-6">
        {/* Question Navigation */}
        <QuestionNav
          questions={questions}
          currentQuestion={activeQuestion}
          onJump={handleJumpToQuestion}
        />

        {/* Questions List */}
        <main className="flex-1 min-w-0 space-y-5">
          {/* Mobile Score Summary */}
          <div className="flex sm:hidden items-center gap-2 text-xs font-bold">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-700">
              ✓ {correctCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700">
              ✗ {incorrectCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500">
              ○ {skippedCount}
            </span>
            <span className="ml-auto text-slate-400 font-normal">
              {questions.length} questions
            </span>
          </div>

          {questions.map((q, i) => (
            <QuestionSolutionCard
              key={q.questionId}
              instituteId={ws.instituteId!}
              testId={testId}
              studentId={candidate.studentId!}
              questionId={q.questionId}
              questionNumber={i + 1}
              hasAttempted={q.hasAttempted}
              studentAnswer={q.studentAnswer}
              correctAnswer={q.correctAnswer}
              isCorrect={q.isCorrect}
              questionText={q.text}
              questionImage={q.questionImage}
              solutionMode={solutionMode}
              timeSpentSeconds={q.timeSpentSeconds}
              answerChangedCount={q.answerChangedCount}
              markedForReview={q.markedForReview}
              firstAnswer={q.firstAnswer}
            />
          ))}
        </main>
      </div>
    </div>
  );
}
