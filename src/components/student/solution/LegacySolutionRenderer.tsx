"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

function Md({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
      {children}
    </ReactMarkdown>
  );
}

/**
 * Legacy V1/V2 Solution Renderer
 *
 * Consolidated, non-duplicating renderer for solutions generated with
 * solution-v1 or solution-v2-strict prompts.
 *
 * Key differences from old renderer:
 * - Single linear flow (NO two-panel split)
 * - Each piece of information appears EXACTLY ONCE
 * - Uses new premium styling (cards, colors, spacing)
 * - Reads V1/V2 fields
 */
export default function LegacySolutionRenderer({
  meta,
  contentMarkdown,
}: {
  meta: any;
  contentMarkdown?: string;
}) {
  if (!meta && !contentMarkdown) return null;

  // Normalize V1 vs V2 fields
  const approach = meta?.approach || meta?.quick_approach || meta?.reasoning || meta?.summary || null;
  const steps = meta?.steps || null; // V2 structured steps
  const essentialSteps = meta?.essential_steps || null; // V1 string steps
  const finalAnswerValue = meta?.finalAnswer?.value || meta?.final_answer || null;
  const finalAnswerOption = meta?.finalAnswer?.option || null;
  const concept = meta?.concept || meta?.primary_concept || null;
  const concepts = meta?.concepts || null;
  const takeaway = meta?.takeaway || null;
  const commonMistake = meta?.commonMistake || null;
  const shortcut = meta?.shortcut || meta?.timeSavingTip || null;
  const difficulty = meta?.difficulty || null;
  const estimatedSolveTime = meta?.estimatedSolveTime || null;
  const topic = meta?.topic || null;

  // If no structured data, fall back to raw markdown
  const hasStructured = approach || steps || essentialSteps;
  if (!hasStructured && contentMarkdown) {
    return (
      <div className="prose prose-slate prose-sm max-w-none text-slate-700 p-4">
        <Md>{contentMarkdown}</Md>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Final Answer */}
      {finalAnswerValue && (
        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50/50 rounded-xl border border-emerald-200/60">
          <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </span>
            Final Answer
          </h4>
          <div className="text-emerald-900 font-bold text-lg pl-7">
            {finalAnswerOption && (
              <span className="text-emerald-600 text-sm font-semibold mr-2">{finalAnswerOption}:</span>
            )}
            <Md>{finalAnswerValue}</Md>
          </div>
        </div>
      )}

      {/* Approach / Key Idea — shown ONCE */}
      {approach && (
        <div className="p-4 bg-gradient-to-r from-purple-50 to-violet-50/30 rounded-xl border border-purple-200/50">
          <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600 text-xs">💡</span>
            Approach
          </h4>
          <div className="text-purple-950 text-[15px] leading-relaxed pl-7">
            <Md>{approach}</Md>
          </div>
        </div>
      )}

      {/* Concept Chips */}
      {(concept || (concepts && concepts.length > 0)) && (
        <div className="flex flex-wrap gap-2">
          {concepts && concepts.length > 0 ? (
            concepts.map((c: string, idx: number) => (
              <span key={idx} className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 tracking-wide">
                {c}
              </span>
            ))
          ) : concept ? (
            <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200/60 tracking-wide">
              {concept}
            </span>
          ) : null}
          {difficulty && (
            <span className={`px-3 py-1.5 text-xs font-semibold rounded-full tracking-wide ml-auto ${
              difficulty === "Hard" || difficulty === "HARD"
                ? "bg-red-50 text-red-700 border border-red-200/60"
                : difficulty === "Medium" || difficulty === "MEDIUM"
                  ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                  : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
            }`}>
              {difficulty}
            </span>
          )}
          {estimatedSolveTime && (
            <span className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-600 border border-slate-200/60 tracking-wide">
              ⏱ {estimatedSolveTime}
            </span>
          )}
        </div>
      )}

      {/* Steps (V2 structured) */}
      {steps && steps.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 text-xs">📝</span>
            Step-by-Step
          </h4>
          <div className="space-y-3">
            {steps.map((step: any, idx: number) => (
              <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {step.title && (
                      <h5 className="font-semibold text-slate-900 text-sm mb-1">{step.title}</h5>
                    )}
                    <div className="text-slate-700 text-[14.5px] leading-relaxed">
                      <Md>{step.explanation || step.reasoning || ""}</Md>
                    </div>
                    {step.equation && (
                      <div className="mt-2 px-4 py-2.5 bg-slate-50 rounded-lg border border-slate-100 overflow-x-auto text-center">
                        <Md>{step.equation.startsWith("$") ? step.equation : `$$${step.equation}$$`}</Md>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Steps (V1 flat strings) */}
      {!steps && essentialSteps && essentialSteps.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-600 text-xs">📝</span>
            Steps
          </h4>
          <div className="space-y-2">
            {essentialSteps.map((step: string, idx: number) => (
              <div key={idx} className="flex gap-3 px-4 py-3 rounded-xl border border-slate-200 bg-white">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0 text-slate-700 text-[14.5px] leading-relaxed">
                  <Md>{step}</Md>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common Mistake — shown ONCE */}
      {commonMistake && (
        <div className="p-4 bg-rose-50/80 rounded-xl border border-rose-200/50">
          <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider mb-1.5">⚠️ Common Mistake</h4>
          <div className="text-rose-800 text-[14px] leading-relaxed">
            <Md>{commonMistake}</Md>
          </div>
        </div>
      )}

      {/* Shortcut — shown ONCE */}
      {shortcut && (
        <div className="p-4 bg-gradient-to-r from-cyan-50 to-sky-50/30 rounded-xl border border-cyan-200/50">
          <h4 className="text-xs font-bold text-cyan-800 uppercase tracking-wider mb-1.5">⚡ Shortcut</h4>
          <div className="text-cyan-950 text-[14.5px] leading-relaxed">
            <Md>{shortcut}</Md>
          </div>
        </div>
      )}

      {/* Takeaway — shown ONCE */}
      {takeaway && (
        <div className="p-4 bg-gradient-to-r from-slate-50 to-zinc-50 rounded-xl border border-slate-200/60 border-l-4 border-l-indigo-400">
          <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">📌 Takeaway</h4>
          <div className="text-slate-900 text-[14.5px] leading-relaxed font-medium">
            <Md>{takeaway}</Md>
          </div>
        </div>
      )}
    </div>
  );
}
