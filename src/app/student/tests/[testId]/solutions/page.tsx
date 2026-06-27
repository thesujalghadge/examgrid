"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useWorkspaceAuthStore } from "@/stores/workspace-auth-store";
import { getRepositories } from "@/lib/repositories/provider";
import { getExamById } from "@/lib/exam-catalog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { verifyAndFetchSolution } from "@/app/student/actions/solution-access";
import { Badge } from "@/components/ui/badge";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import type { ExamQuestion } from "@/types/exam";
import type { TestQuestionResult, TestResultBreakdown } from "@/types/test-session";
import type { CBTTest } from "@/types/cbt";

type SolutionPayload = {
  content_markdown?: string;
  final_answer?: string;
  ai_metadata?: {
    topic?: string;
    subtopic?: string;
    difficulty?: string;
    primary_concept?: string;
    secondary_concept?: string;
    quick_approach?: string;
    essential_steps?: string[];
    
    // V2
    concept?: string;
    approach?: string;
    steps?: {
      title: string;
      explanation: string;
      equation?: string;
    }[];
    finalAnswer?: {
      value: string;
      option?: string;
    };
    takeaway?: string;
    commonMistake?: string;
    shortcut?: string;
    timeSavingTip?: string;
    estimatedSolveTime?: string;
    examFrequency?: string;
  };
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
};

function LazySolutionCard({ 
  instituteId, testId, studentRoll, questionId, hasAttempted, 
  studentAnswer, correctAnswer, isCorrect, questionText, questionImage
}: { 
  instituteId: string, testId: string, studentRoll: string, questionId: string, hasAttempted: boolean,
  studentAnswer: string | null, correctAnswer: string | null, isCorrect: boolean, questionText: string, questionImage?: string
}) {
  const [solution, setSolution] = useState<SolutionPayload | null>(null);
  const [progress, setProgress] = useState<{completed: number, total: number, estimatedMinutes: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSolution = async () => {
    setLoading(true);
    setError(null);
    setProgress(null);
    const res = await verifyAndFetchSolution(instituteId, testId, studentRoll, questionId, hasAttempted);
    if (res.error) {
      setError(res.error);
    } else if (res.progress) {
      setProgress(res.progress);
    } else {
      setSolution(res.data ?? null);
    }
    setLoading(false);
  };

  const meta = solution?.ai_metadata;
  const isV2 = !!meta?.steps;
  const qNumMatch = questionText.match(/^Q(\d+)\./);
  const qNum = qNumMatch ? qNumMatch[1] : "";
  const cleanQText = qNumMatch ? questionText.substring(questionText.indexOf('.') + 1).trim() : questionText;

  return (
    <Card className="mb-8 border border-slate-200 shadow-sm bg-white overflow-hidden">
      <CardContent className="p-0">
        <div className="p-6 md:p-8">
          {/* Header Info */}
          <div className="flex flex-col sm:flex-row justify-between items-start mb-6 pb-6 border-b border-slate-100">
             <div>
               <h3 className="font-bold text-slate-900 text-lg mb-1">Question {qNum}</h3>
               {meta?.topic && <p className="text-sm text-slate-500 font-medium">{meta.topic}</p>}
             </div>
             <div className="flex gap-2 mt-2 sm:mt-0">
               {meta?.difficulty && (
                  <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200">{meta.difficulty}</Badge>
               )}
               {meta?.estimatedSolveTime && (
                  <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200">⏱️ {meta.estimatedSolveTime}</Badge>
               )}
               {meta?.examFrequency && (
                  <Badge variant="outline" className="text-slate-600 bg-slate-50 border-slate-200">📈 {meta.examFrequency}</Badge>
               )}
             </div>
          </div>
          
          {/* Question Body */}
          <div className="mb-8">
             {questionImage ? (
               <img src={questionImage} alt="Question" className="max-w-full h-auto object-contain rounded-md border border-slate-100" />
             ) : (
               <div className="text-slate-800 text-base leading-relaxed whitespace-pre-wrap">
                 <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                   {cleanQText}
                 </ReactMarkdown>
               </div>
             )}
          </div>
          
          {/* Answer Status */}
          <div className="flex flex-wrap gap-6 items-center p-5 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Your Answer</span>
              <span className={`text-base font-bold ${isCorrect ? "text-emerald-600" : (studentAnswer ? "text-rose-600" : "text-slate-500")}`}>
                {studentAnswer || "N/A"}
              </span>
            </div>
            <div className="w-px h-10 bg-slate-200 hidden sm:block"></div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Correct Answer</span>
              <span className="text-base font-bold text-slate-900">{correctAnswer || "None"}</span>
            </div>
            <div className="ml-auto flex items-center">
              {isCorrect ? (
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-bold rounded-md flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Correct
                </span>
              ) : studentAnswer ? (
                <span className="px-3 py-1 bg-rose-100 text-rose-800 text-sm font-bold rounded-md flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg> Incorrect
                </span>
              ) : (
                <span className="px-3 py-1 bg-slate-100 text-slate-600 text-sm font-bold rounded-md">
                  Not Attempted
                </span>
              )}
            </div>
          </div>
        </div>

        {solution ? (
          <div className="border-t-4 border-slate-100 p-6 md:p-8 space-y-10 bg-white">
            
            {/* Concept */}
            {(meta?.concept || meta?.primary_concept) && (
              <div className="solution-section">
                <h4 className="text-[15px] font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">💡 Concept</h4>
                <div className="text-slate-700 text-base leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {meta?.concept || meta?.primary_concept || ""}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Approach */}
            {(meta?.approach || meta?.quick_approach) && (
              <div className="solution-section">
                <h4 className="text-[15px] font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">🧠 Approach</h4>
                <div className="text-slate-700 text-base leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {meta?.approach || meta?.quick_approach || ""}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Steps */}
            {(meta?.steps || meta?.essential_steps) && (
              <div className="solution-section">
                <h4 className="text-[15px] font-bold text-slate-900 uppercase tracking-wider mb-6 flex items-center gap-2">📝 Step-by-Step Solution</h4>
                
                {isV2 ? (
                  <div className="space-y-8">
                    {meta.steps?.map((step: any, idx: number) => (
                      <div key={idx} className="pb-8 border-b border-slate-100 last:border-0 last:pb-0">
                        <h5 className="font-bold text-slate-900 mb-2 text-base">Step {idx + 1}{step.title ? `: ${step.title}` : ''}</h5>
                        <div className="text-slate-700 mb-4 leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {step.explanation}
                          </ReactMarkdown>
                        </div>
                        {step.equation && (
                          <div className="text-slate-900 overflow-x-auto py-3 px-4 bg-slate-50 rounded-lg border border-slate-100">
                            <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                              {step.equation.startsWith('$') ? step.equation : `$$${step.equation}$$`}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {meta.essential_steps?.map((step: string, idx: number) => (
                      <div key={idx} className="pb-6 border-b border-slate-100 last:border-0 last:pb-0">
                        <h5 className="font-bold text-slate-900 mb-2 text-base">Step {idx + 1}</h5>
                        <div className="text-slate-700 leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                            {step}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Final Answer */}
            {(meta?.finalAnswer || solution?.final_answer) && (
              <div className="solution-section">
                <h4 className="text-[15px] font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">🟩 Final Answer</h4>
                <div className="inline-block p-5 bg-white border-2 border-slate-200 rounded-xl min-w-[200px]">
                  {meta?.finalAnswer?.option && (
                    <div className="text-sm font-semibold text-slate-500 mb-2 uppercase tracking-wide">{meta.finalAnswer.option}</div>
                  )}
                  <div className="text-slate-900 font-bold text-lg">
                    <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                      {meta?.finalAnswer?.value || solution?.final_answer || ""}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}

            {/* Key Takeaway */}
            {meta?.takeaway && (
              <div className="solution-section">
                <h4 className="text-[15px] font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">📌 Key Takeaway</h4>
                <div className="text-slate-700 text-base leading-relaxed p-5 bg-slate-50 rounded-xl border border-slate-100">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {meta.takeaway}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Common Mistake */}
            {meta?.commonMistake && (
              <div className="solution-section">
                <h4 className="text-[15px] font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">⚠️ Common Mistake</h4>
                <div className="text-slate-700 text-base leading-relaxed p-5 bg-rose-50/50 rounded-xl border border-rose-100">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {meta.commonMistake}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Shortcut */}
            {meta?.shortcut && (
              <div className="solution-section">
                <h4 className="text-[15px] font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">⚡ Shortcut</h4>
                <div className="text-slate-700 text-base leading-relaxed p-5 bg-amber-50/50 rounded-xl border border-amber-100">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {meta.shortcut}
                  </ReactMarkdown>
                </div>
              </div>
            )}

            {/* Time Saving Tip */}
            {meta?.timeSavingTip && (
              <div className="solution-section">
                <h4 className="text-[15px] font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">⏱️ Time Saving Tip</h4>
                <div className="text-slate-700 text-base leading-relaxed p-5 bg-emerald-50/50 rounded-xl border border-emerald-100">
                  <ReactMarkdown remarkPlugins={[remarkMath]} rehypePlugins={[rehypeKatex]}>
                    {meta.timeSavingTip}
                  </ReactMarkdown>
                </div>
              </div>
            )}

          </div>
        ) : progress ? (
          <div className="p-6 md:p-8 bg-amber-50/50 border-t border-amber-100 text-sm text-amber-800">
            <h4 className="font-semibold mb-2 text-base text-amber-900">Solutions being prepared</h4>
            <p className="mb-1 text-amber-700">{progress.completed} / {progress.total} completed.</p>
            <p className="text-amber-700">Estimated time remaining: ~{progress.estimatedMinutes} minutes.</p>
            <Button variant="outline" className="mt-4 bg-white border-amber-200 text-amber-900 hover:bg-amber-50" onClick={fetchSolution} disabled={loading}>
              {loading ? "Checking..." : "Refresh Status"}
            </Button>
          </div>
        ) : error ? (
          <div className="p-6 md:p-8 bg-rose-50/50 border-t border-rose-100 text-sm text-rose-800">
            <div className="font-medium text-rose-900">{error}</div>
          </div>
        ) : (
          <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 flex justify-center">
            <Button 
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8 py-2 rounded-lg transition-colors" 
              onClick={fetchSolution} 
              disabled={loading}
            >
              {loading ? "Loading Solution..." : "Show Solution"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StudentSolutionsPage() {
  const params = useParams();
  const testId = params.testId as string;
  const router = useRouter();
  
  const candidate = useAuthStore((s) => s.candidate);
  const ws = useWorkspaceAuthStore((s) => s.session);
  
  const [attemptData, setAttemptData] = useState<AttemptResultPayload | null | undefined>(undefined);
  const [testData, setTestData] = useState<CBTTest | null>(null);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!candidate || !ws?.instituteId) {
      router.replace("/student/login");
      return;
    }

    fetch(`/api/cbt/test-session/result?testId=${encodeURIComponent(testId)}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        if (res.status === 404) {
          return null; // Unattempted
        }
        if (!res.ok) throw new Error("Could not load submitted attempt.");
        return res.json();
      })
      .then((data: AttemptResultPayload | null) => setAttemptData(data))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Could not load submitted attempt.");
      });
  }, [candidate, ws, testId, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fa] p-6 text-center">
        <p className="text-sm text-slate-500">{error}</p>
        <Button variant="outline" className="border-slate-300" onClick={() => router.push(`/student/tests/${testId}/result`)}>
          Back to Result
        </Button>
      </div>
    );
  }

  const exam = getExamById(testId);

  if (attemptData === undefined || !ws?.instituteId || !candidate) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 bg-[#f8f9fa]">Loading...</div>;
  }

  const breakdown = attemptData?.resultBreakdown as TestResultBreakdown | undefined;
  if (!exam) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500 bg-[#f8f9fa]">Exam data could not be loaded.</div>;
  }

  const releaseMs = exam.solutionsReleaseTime ? new Date(exam.solutionsReleaseTime).getTime() : 0;
  const isReleased = releaseMs === 0 || currentTime >= releaseMs;

  if (!isReleased) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f8f9fa] p-6 text-center">
        <Card className="max-w-md w-full border-slate-200 shadow-sm">
          <CardContent className="pt-8 pb-8">
            <h2 className="text-xl font-bold text-slate-900 mb-2">Solutions Not Yet Available</h2>
            <p className="text-sm text-slate-600 mb-6">
              Solutions for this exam will be released at:
              <br />
              <span className="text-lg font-bold text-slate-900 mt-2 block">
                {new Date(releaseMs).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </p>
            <Button variant="outline" className="w-full border-slate-300" onClick={() => router.push(`/student/tests/${testId}/result`)}>
              Back to Result
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const resultByQuestion = new Map(
    breakdown?.perQuestion?.map((row: TestQuestionResult) => [row.questionId, row]) ?? [],
  );

  const answerLabel = (question: ExamQuestion, answer: string | null | undefined) => {
    if (!answer) return null;
    if (question.type === "NUMERICAL" || question.type === "INTEGER") return answer;
    
    if (answer.includes(",")) {
       return answer.split(",").map(ans => {
         const opt = question.options.find((o) => o.id === ans);
         return opt ? `Option ${opt.label}` : ans;
       }).sort().join(", ");
    }
    
    const opt = question.options.find((o) => o.id === answer);
    return opt ? `Option ${opt.label}` : answer;
  };

  const correctLabel = (question: ExamQuestion) => {
    if (question.type === "NUMERICAL" || question.type === "INTEGER") return question.correctNumericalAnswer ?? null;
    if (!question.correctOptionId) return null;
    
    if (question.correctOptionId.includes(",")) {
       return question.correctOptionId.split(",").map(ans => {
          const opt = question.options.find((o) => o.id === ans);
          if (opt) return `Option ${opt.label}`;
          const labelMap: Record<string, string> = { A: "Option A", B: "Option B", C: "Option C", D: "Option D" };
          return labelMap[ans] ?? ans;
       }).sort().join(", ");
    }
    
    const opt = question.options.find((o) => o.id === question.correctOptionId);
    if (opt) return `Option ${opt.label}`;
    
    const labelMap: Record<string, string> = { A: "Option A", B: "Option B", C: "Option C", D: "Option D" };
    return labelMap[question.correctOptionId] ?? question.correctOptionId;
  };

  const questions = exam.sections.flatMap((section) => section.questionIds).map((questionId) => {
    const question = exam.questions[questionId];
    const response = resultByQuestion.get(questionId);

    const questionImage = question?.stemImage || (question?.images && question.images.length > 0 ? question.images[0] : undefined);

    return {
      questionId,
      text: question?.text || "Question text unavailable",
      questionImage,
      studentAnswer: question ? answerLabel(question, response?.selected) : null,
      correctAnswer: question ? correctLabel(question) : null,
      isCorrect: response?.correct ?? false,
      hasAttempted: Boolean(response?.selected),
    };
  });

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sticky top-0 z-10">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Solutions Review</h1>
          <p className="text-sm text-slate-500 font-medium">{exam.title}</p>
        </div>
        <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50" onClick={() => router.push(`/student/tests/${testId}/result`)}>
          Back to Result
        </Button>
      </header>

      <main className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Detailed Solutions</h2>
          <p className="text-base text-slate-600">Review step-by-step explanations for your attempted questions.</p>
        </div>

        {questions.map((q: SolutionQuestionRow, i: number) => (
          <LazySolutionCard
            key={q.questionId}
            instituteId={ws.instituteId!}
            testId={testId}
            studentRoll={candidate.rollNumber}
            questionId={q.questionId}
            hasAttempted={q.hasAttempted}
            studentAnswer={q.studentAnswer}
            correctAnswer={q.correctAnswer}
            isCorrect={q.isCorrect}
            questionText={`Q${i+1}. ${q.text}`}
            questionImage={q.questionImage}
          />
        ))}
      </main>
    </div>
  );
}

