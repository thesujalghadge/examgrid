"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

// ─── Shared Markdown Renderer ───────────────────────────────────────────────
function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </ReactMarkdown>
  );
}

// ─── Step Card ──────────────────────────────────────────────────────────────
function StepCard({
  index,
  title,
  reasoning,
  equation,
  result,
  defaultExpanded = true,
}: {
  index: number;
  title: string;
  reasoning: string;
  equation?: string | null;
  result?: string | null;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden transition-all duration-200 hover:shadow-md">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left group transition-colors hover:bg-slate-50/80"
      >
        {/* Step number circle */}
        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-sm font-bold flex items-center justify-center shadow-sm">
          {index + 1}
        </span>
        <span className="font-semibold text-slate-900 text-[15px] flex-1">{title}</span>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-slate-100">
          {/* Reasoning */}
          <div className="text-slate-700 text-[14.5px] leading-relaxed mt-3 pl-11">
            <Md>{reasoning}</Md>
          </div>

          {/* Equation */}
          {equation && (
            <div className="mt-3 ml-11 px-4 py-3 bg-gradient-to-r from-slate-50 to-indigo-50/30 rounded-lg border border-slate-100 overflow-x-auto">
              <div className="text-slate-900 text-center">
                <Md>{equation.startsWith("$") ? equation : `$$${equation}$$`}</Md>
              </div>
            </div>
          )}

          {/* Intermediate result */}
          {result && (
            <div className="mt-2.5 ml-11">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg border border-indigo-100">
                <span className="text-indigo-400">→</span> {result}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── V3 Solution Metadata Type ──────────────────────────────────────────────
type V3Meta = {
  examMode?: {
    concepts: string[];
    keyEquations: string[];
    fastSteps: string[];
    examTricks?: string[] | null;
    estimatedSolveTime: string;
    finalAnswerSummary?: string | null;
    confidenceScore?: number;
  };
  learnMode?: {
    keyIdea: string;
    conceptChips: string[];
    notations?: { symbol: string; meaning: string }[];
    steps: {
      title: string;
      reasoning: string;
      equation?: string | null;
      result?: string | null;
    }[];
    importantObservation?: string | null;
    commonMistakes?: string[] | null;
    takeaway: string;
    assumptions?: { assumption: string; validity: string; failure: string }[] | null;
  };
  // Fallbacks for the initial v3 shape just in case
  keyIdea?: string;
  conceptChips?: string[];
  notations?: { symbol: string; meaning: string }[];
  steps?: { title: string; reasoning: string; equation?: string | null; result?: string | null; }[];
  importantObservation?: string | null;
  commonMistakes?: string[] | null;
  shortcut?: string | null;
  takeaway?: string;
  assumptions?: { assumption: string; validity: string; failure: string }[] | null;

  // Flat JSON fallbacks (from background worker)
  summary?: string;
  concepts?: string[];
  formulas?: string[];
  commonMistake?: string | null;
  confidence?: number;

  finalAnswer: { value: string; option?: string | null };
  subject?: string;
  topic?: string;
  subtopic?: string;
  difficulty?: string;
  questionType?: string;
  estimatedSolveTime?: string;
  isTeacherReviewed?: boolean;
};

// ─── Main Solution Card (V3 Premium Renderer) ──────────────────────────────
export default function SolutionCard({
  meta,
  contentMarkdown,
  hasAttempted,
  studentAnswer,
  correctAnswer,
  isCorrect,
  mode = "EXAM",
}: {
  meta: V3Meta;
  contentMarkdown?: string;
  hasAttempted: boolean;
  studentAnswer: string | null;
  correctAnswer: string | null;
  isCorrect: boolean;
  mode?: "EXAM" | "LEARN";
}) {
  // Collapse advanced sections by default in learn mode
  const [showMistakes, setShowMistakes] = useState(false);
  const [showAssumptions, setShowAssumptions] = useState(false);

  // Normalize fallback data
  const learn = meta.learnMode || {
    keyIdea: meta.keyIdea || meta.summary || "",
    conceptChips: meta.conceptChips || meta.concepts || [],
    notations: meta.notations || [],
    steps: meta.steps || [],
    importantObservation: meta.importantObservation,
    commonMistakes: meta.commonMistakes || (meta.commonMistake ? [meta.commonMistake] : null),
    takeaway: meta.takeaway || meta.shortcut || "",
    assumptions: meta.assumptions,
  };

  const exam = meta.examMode || (meta.concepts ? {
    concepts: meta.concepts || [],
    keyEquations: meta.formulas || [],
    fastSteps: (meta.steps || []).map((s: any) => s.explanation || s.reasoning || s.title || ""),
    estimatedSolveTime: meta.estimatedSolveTime || "2 mins",
    confidenceScore: meta.confidence ? Math.round(meta.confidence / 10) : undefined,
  } : undefined);

  const isExamMode = mode === "EXAM" && exam;

  return (
    <div className="space-y-0">
      {/* ─── Final Answer (Shared) ─────────────────────────────────── */}
      <div className="p-5 bg-gradient-to-r from-emerald-50 to-teal-50/50 rounded-xl border border-emerald-200/60">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </span>
          <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Final Answer</h4>
          {meta.isTeacherReviewed && (
            <span className="ml-auto text-[10px] font-bold text-emerald-600 uppercase tracking-wider bg-emerald-100 px-2 py-0.5 rounded-full">Teacher Verified</span>
          )}
        </div>
        <div className="text-emerald-900 font-bold text-lg pl-7">
          {meta.finalAnswer.option && (
            <span className="text-emerald-600 text-sm font-semibold mr-2">{meta.finalAnswer.option}:</span>
          )}
          <Md>{meta.finalAnswer.value}</Md>
        </div>
      </div>

      {isExamMode ? (
        /* ─── EXAM STRATEGY RENDERING (DENSE, < 1.5 Viewports) ────────── */
        <div className="mt-3 space-y-3">
          {/* Metadata Bar */}
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            {meta.difficulty && (
              <span className={`px-2 py-1 rounded bg-slate-100 ${
                meta.difficulty === "Hard" ? "text-red-700" :
                meta.difficulty === "Medium" ? "text-amber-700" : "text-emerald-700"
              }`}>
                Difficulty: {meta.difficulty}
              </span>
            )}
            {exam.estimatedSolveTime && (
              <span className="px-2 py-1 rounded bg-slate-100 text-slate-700">
                ⏱ Expected Time: {exam.estimatedSolveTime}
              </span>
            )}
            {exam.confidenceScore && (
              <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 ml-auto">
                Confidence: {exam.confidenceScore}/10
              </span>
            )}
          </div>

          {/* Concepts & Key Equations (Dense Row) */}
          <div className="flex flex-col sm:flex-row gap-3">
            {exam.concepts && exam.concepts.length > 0 && (
              <div className="flex-1 p-3 bg-blue-50/50 rounded-lg border border-blue-100/50">
                <span className="text-[10px] font-bold text-blue-800 uppercase mb-1 block">Concepts</span>
                <p className="text-sm text-blue-950 font-medium leading-snug">{exam.concepts.join(" • ")}</p>
              </div>
            )}
            {exam.keyEquations && exam.keyEquations.length > 0 && (
              <div className="flex-1 p-3 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                <span className="text-[10px] font-bold text-indigo-800 uppercase mb-1 block">Key Equations</span>
                <div className="text-sm text-indigo-950 font-medium leading-snug">
                  <Md>{exam.keyEquations.map(eq => eq.startsWith("$") ? eq : `$${eq}$`).join(" \\quad ")}</Md>
                </div>
              </div>
            )}
          </div>

          {/* Fast Steps (List) */}
          {exam.fastSteps && exam.fastSteps.length > 0 && (
            <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 block">Fast Steps</span>
              <ul className="space-y-2">
                {exam.fastSteps.map((step, idx) => (
                  <li key={idx} className="flex gap-2 text-sm text-slate-800 leading-relaxed">
                    <span className="text-slate-400 font-medium">{idx + 1}.</span>
                    <div className="flex-1"><Md>{step}</Md></div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Exam Tricks (Optional) */}
          {exam.examTricks && exam.examTricks.length > 0 && (
            <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50/30 rounded-lg border border-amber-200/50 border-l-2 border-l-amber-400">
              <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider mb-1 block">💡 Exam Trick</span>
              <ul className="space-y-1">
                {exam.examTricks.map((trick, idx) => (
                  <li key={idx} className="text-[13px] text-amber-950 leading-snug"><Md>{trick}</Md></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        /* ─── CONCEPT BREAKDOWN RENDERING (PEDAGOGICAL, DETAILED) ─────── */
        <div className="mt-4 space-y-4">
          {/* Key Idea */}
          <div className="p-5 bg-gradient-to-r from-purple-50 to-violet-50/30 rounded-xl border border-purple-200/50">
            <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 text-xs">💡</span>
              Key Idea
            </h4>
            <div className="text-purple-950 text-[15px] leading-relaxed font-medium pl-7">
              <Md>{learn.keyIdea}</Md>
            </div>
          </div>

          {/* Concept Chips */}
          {learn.conceptChips && learn.conceptChips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {learn.conceptChips.map((chip, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 tracking-wide"
                >
                  {chip}
                </span>
              ))}
              {meta.difficulty && (
                <span className={`px-3 py-1.5 text-xs font-semibold rounded-full tracking-wide ml-auto ${
                  meta.difficulty === "Hard"
                    ? "bg-red-50 text-red-700 border border-red-200/60"
                    : meta.difficulty === "Medium"
                      ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                      : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                }`}>
                  {meta.difficulty}
                </span>
              )}
            </div>
          )}

          {/* Notations */}
          {learn.notations && learn.notations.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 rounded-lg border border-slate-200/60">
              <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Notation</h4>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                {learn.notations.map((n, idx) => (
                  <span key={idx} className="text-sm text-slate-700">
                    <span className="font-mono font-semibold text-slate-900">{n.symbol}</span>
                    <span className="text-slate-400 mx-1">=</span>
                    <span>{n.meaning}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Step-by-Step Solution */}
          {learn.steps && learn.steps.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 text-xs">📝</span>
                Step-by-Step Solution
              </h4>
              <div className="space-y-2.5">
                {learn.steps.map((step, idx) => (
                  <StepCard
                    key={idx}
                    index={idx}
                    title={step.title}
                    reasoning={step.reasoning}
                    equation={step.equation}
                    result={step.result}
                    defaultExpanded={idx < 3}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Important Observation */}
          {learn.importantObservation && (
            <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50/30 rounded-xl border border-amber-200/50 border-l-4 border-l-amber-400">
              <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                🔍 Important Observation
              </h4>
              <div className="text-amber-950 text-[14.5px] leading-relaxed">
                <Md>{learn.importantObservation}</Md>
              </div>
            </div>
          )}

          {/* Common Mistakes */}
          {learn.commonMistakes && learn.commonMistakes.length > 0 && (
            <div>
              <button
                onClick={() => setShowMistakes(!showMistakes)}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-50/80 border border-rose-200/50 text-left hover:bg-rose-50 transition-colors"
              >
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5 flex-1">
                  ⚠️ Common Mistakes
                  <span className="text-rose-400 font-normal normal-case text-[11px]">({learn.commonMistakes.length})</span>
                </span>
                <svg
                  className={`w-4 h-4 text-rose-400 transition-transform duration-200 ${showMistakes ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showMistakes && (
                <div className="mt-2 space-y-2 px-1">
                  {learn.commonMistakes.map((mistake, idx) => (
                    <div key={idx} className="flex gap-2.5 px-4 py-2.5 bg-white rounded-lg border border-rose-100">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-rose-100 text-rose-600 text-[10px] font-bold flex items-center justify-center mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="text-rose-800 text-[14px] leading-relaxed flex-1">
                        <Md>{mistake}</Md>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Assumptions */}
          {learn.assumptions && learn.assumptions.length > 0 && (
            <div>
              <button
                onClick={() => setShowAssumptions(!showAssumptions)}
                className="w-full flex items-center gap-2 px-4 py-3 rounded-xl bg-sky-50/80 border border-sky-200/50 text-left hover:bg-sky-50 transition-colors"
              >
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider flex-1">
                  📐 Assumptions Used
                </span>
                <svg
                  className={`w-4 h-4 text-sky-400 transition-transform duration-200 ${showAssumptions ? "rotate-180" : ""}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showAssumptions && (
                <div className="mt-2 space-y-2 px-1">
                  {learn.assumptions.map((a, idx) => (
                    <div key={idx} className="px-4 py-3 bg-white rounded-lg border border-sky-100 text-sm">
                      <div className="font-semibold text-sky-900 mb-1">{a.assumption}</div>
                      <div className="text-sky-700"><span className="text-sky-500 font-medium">Valid when:</span> {a.validity}</div>
                      <div className="text-sky-700"><span className="text-rose-500 font-medium">Fails when:</span> {a.failure}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Takeaway */}
          {learn.takeaway && (
            <div className="p-4 bg-gradient-to-r from-slate-50 to-zinc-50 rounded-xl border border-slate-200/60 border-l-4 border-l-indigo-400">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                📌 Takeaway
              </h4>
              <div className="text-slate-900 text-[14.5px] leading-relaxed font-medium">
                <Md>{learn.takeaway}</Md>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
