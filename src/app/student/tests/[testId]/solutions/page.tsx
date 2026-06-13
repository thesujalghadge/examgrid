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
import type { ExamQuestion } from "@/types/exam";
import type { TestQuestionResult, TestResultBreakdown } from "@/types/test-session";
import type { CBTTest } from "@/types/cbt";

type SolutionPayload = {
  content_markdown?: string;
  final_answer?: string;
  ai_metadata?: {
    taxonomy?: {
      topic?: string;
    };
    difficulty?: string;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSolution = async () => {
    setLoading(true);
    setError(null);
    const res = await verifyAndFetchSolution(instituteId, testId, studentRoll, questionId, hasAttempted);
    if (res.error) {
      setError(res.error);
    } else {
      setSolution(res.data ?? null);
    }
    setLoading(false);
  };

  return (
    <Card className="mb-4 border border-[#ece6da]">
      <CardContent className="pt-4 space-y-4">
        {questionImage ? (
          <div className="mb-4">
            <span className="font-bold text-[#14213d] mr-2">{questionText.split('.')[0]}.</span>
            <img src={questionImage} alt="Question" className="max-w-full h-auto object-contain rounded-md mt-2" />
          </div>
        ) : (
          <p className="font-medium text-[#14213d] whitespace-pre-wrap">{questionText}</p>
        )}
        
        <div className="flex gap-4 items-center">
          <div className="flex flex-col">
            <span className="text-xs text-[#5e5a52] uppercase">Your Answer</span>
            <span className={`text-base font-semibold ${isCorrect ? "text-green-600" : (studentAnswer ? "text-red-600" : "text-gray-500")}`}>
              {studentAnswer || "Not Attempted"}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-[#5e5a52] uppercase">Correct Answer</span>
            <span className="text-base font-semibold text-[#14213d]">{correctAnswer || "None"}</span>
          </div>
          <div className="ml-auto">
            {isCorrect ? (
              <Badge className="bg-green-100 text-green-800 border-green-200">✓ Correct</Badge>
            ) : studentAnswer ? (
              <Badge className="bg-red-100 text-red-800 border-red-200">✗ Incorrect</Badge>
            ) : (
              <Badge variant="outline" className="text-gray-500 border-gray-200">Unattempted</Badge>
            )}
          </div>
        </div>

        {solution ? (
          <div className="bg-[#fbf9f4] rounded-lg p-4 mt-4 border border-[#ece6da]">
            <div className="flex gap-2 mb-3">
              {solution.ai_metadata?.taxonomy?.topic && (
                <Badge variant="outline" className="bg-white">Topic: {solution.ai_metadata.taxonomy.topic}</Badge>
              )}
              {solution.ai_metadata?.difficulty && (
                <Badge variant="outline" className="bg-white">Difficulty: {solution.ai_metadata.difficulty}</Badge>
              )}
            </div>
            <div className="text-sm text-[#14213d] prose prose-sm max-w-none whitespace-pre-wrap">
              {solution.content_markdown}
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <Button 
            variant="outline" 
            className="w-full mt-2" 
            onClick={fetchSolution} 
            disabled={loading}
          >
            {loading ? "Loading..." : "Show Solution"}
          </Button>
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
    const test = getRepositories().cbtTests.getById(testId);
    if (!test) {
      router.replace("/student/tests");
      return;
    }
    setTestData(test);

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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f1e8] p-6 text-center">
        <p className="text-sm text-[#5e5a52]">{error}</p>
        <Button onClick={() => router.push(`/student/tests/${testId}/result`)}>
          Back to Result
        </Button>
      </div>
    );
  }

  // Allow attemptData to be strictly null (meaning unattempted), but undefined means loading
  if (attemptData === undefined || !testData || !ws?.instituteId || !candidate) {
    return <div className="p-8 text-center text-gray-500">Loading...</div>;
  }

  const exam = getExamById(testId);
  const breakdown = attemptData?.resultBreakdown as TestResultBreakdown | undefined;
  if (!exam) {
    return <div className="p-8 text-center text-gray-500">Exam data could not be loaded.</div>;
  }

  const releaseMs = exam.solutionsReleaseTime ? new Date(exam.solutionsReleaseTime).getTime() : 0;
  const isReleased = releaseMs === 0 || currentTime >= releaseMs;

  if (!isReleased) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f1e8] p-6 text-center">
        <Card className="max-w-md w-full border-[#ece6da]">
          <CardContent className="pt-6">
            <h2 className="text-xl font-bold text-[#14213d] mb-2">Solutions Not Yet Available</h2>
            <p className="text-sm text-[#5e5a52] mb-4">
              Solutions for this exam will be released at:
              <br />
              <span className="text-base font-semibold text-[#14213d] mt-2 block">
                {new Date(releaseMs).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </p>
            <Button onClick={() => router.push(`/student/tests/${testId}/result`)}>
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
    if (question.type === "NUMERICAL") return answer;
    const index = question.options.findIndex((option) => option.id === answer);
    return index >= 0 ? String(index + 1) : answer;
  };

  const correctLabel = (question: ExamQuestion) => {
    if (question.type === "NUMERICAL") return question.correctNumericalAnswer ?? null;
    const index = question.options.findIndex((option) => option.id === question.correctOptionId);
    return index >= 0 ? String(index + 1) : null;
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
    <div className="min-h-screen bg-[#f5f1e8]">
      <header className="bg-[#14213d] px-6 py-4 text-white flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold">Solutions Review</h1>
          <p className="text-sm text-blue-100">{testData.title}</p>
        </div>
        <Button variant="outline" className="text-black" onClick={() => router.push(`/student/tests/${testId}/result`)}>
          Back to Result
        </Button>
      </header>

      <main className="mx-auto max-w-4xl p-6 space-y-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#14213d] mb-2">Available Solutions</h2>
          <p className="text-sm text-[#5e5a52]">Review your submitted answers and available solutions.</p>
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
