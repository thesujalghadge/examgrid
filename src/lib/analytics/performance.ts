import { isNumericalAnswerAttempted, isNumericalAnswerCorrect } from "@/lib/numerical";
import type {
  AcademicPerformanceBreakdown,
  ExamDefinition,
  ExamQuestion,
  PersistedExamAttempt,
  ResultAcademicInsights,
  TopicAnalysis,
} from "@/types/exam";

interface BucketAccumulator {
  name: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  score: number;
  solveTimeSeconds: number;
}

function isAttempted(question: ExamQuestion, answer: string | null): boolean {
  if (!answer) return false;
  if (question.type === "NUMERICAL") return isNumericalAnswerAttempted(answer);
  return answer.length > 0;
}

function isCorrect(question: ExamQuestion, answer: string): boolean {
  if (question.type === "NUMERICAL") {
    return isNumericalAnswerCorrect(answer, question.correctNumericalAnswer);
  }
  return answer === question.correctOptionId;
}

function bucket(
  map: Map<string, BucketAccumulator>,
  key: string,
  patch: Pick<BucketAccumulator, "name"> & Partial<BucketAccumulator>,
): BucketAccumulator {
  const existing = map.get(key);
  if (existing) return existing;
  const created: BucketAccumulator = {
    name: patch.name,
    subject: patch.subject,
    chapter: patch.chapter,
    topic: patch.topic,
    total: 0,
    attempted: 0,
    correct: 0,
    incorrect: 0,
    score: 0,
    solveTimeSeconds: 0,
  };
  map.set(key, created);
  return created;
}

function addQuestion(bucketValue: BucketAccumulator, question: ExamQuestion, answer: string | null): void {
  bucketValue.total++;
  bucketValue.solveTimeSeconds += question.estimatedSolveTimeSeconds ?? 0;
  if (!isAttempted(question, answer)) return;
  bucketValue.attempted++;
  if (isCorrect(question, answer!)) {
    bucketValue.correct++;
    bucketValue.score += question.marks;
  } else {
    bucketValue.incorrect++;
    bucketValue.score -= question.negativeMarks;
  }
}

function toBreakdown(bucketValue: BucketAccumulator): AcademicPerformanceBreakdown {
  return {
    name: bucketValue.name,
    total: bucketValue.total,
    attempted: bucketValue.attempted,
    correct: bucketValue.correct,
    incorrect: bucketValue.incorrect,
    unattempted: bucketValue.total - bucketValue.attempted,
    accuracy:
      bucketValue.attempted === 0
        ? 0
        : Math.round((bucketValue.correct / bucketValue.attempted) * 1000) / 10,
    averageSolveTimeSeconds:
      bucketValue.total === 0
        ? 0
        : Math.round(bucketValue.solveTimeSeconds / bucketValue.total),
    score: Math.round(bucketValue.score * 100) / 100,
  };
}

function toTopicAnalysis(bucketValue: BucketAccumulator): TopicAnalysis {
  return {
    ...toBreakdown(bucketValue),
    subject: bucketValue.subject ?? "Unspecified",
    chapter: bucketValue.chapter ?? "Unspecified",
    topic: bucketValue.topic ?? bucketValue.name,
  };
}

function sortWeakTopics(topics: TopicAnalysis[]): TopicAnalysis[] {
  return [...topics]
    .filter((topic) => topic.total > 0)
    .sort((a, b) => a.accuracy - b.accuracy || b.incorrect - a.incorrect || b.total - a.total);
}

function sortStrongTopics(topics: TopicAnalysis[]): TopicAnalysis[] {
  return [...topics]
    .filter((topic) => topic.attempted > 0)
    .sort((a, b) => b.accuracy - a.accuracy || b.correct - a.correct || b.total - a.total);
}

export function buildAcademicInsights(
  exam: ExamDefinition,
  attempt: PersistedExamAttempt,
): ResultAcademicInsights {
  const subjectBuckets = new Map<string, BucketAccumulator>();
  const chapterBuckets = new Map<string, BucketAccumulator>();
  const topicBuckets = new Map<string, BucketAccumulator>();
  const difficultyBuckets = new Map<string, BucketAccumulator>();
  const archetypeBuckets = new Map<string, BucketAccumulator>();
  const mistakeBuckets = new Map<string, BucketAccumulator>();
  const allQuestionIds = exam.sections.flatMap((section) => section.questionIds);

  allQuestionIds.forEach((questionId) => {
    const question = exam.questions[questionId];
    const answer = attempt.answers[questionId] ?? null;
    const subject = question.subject ?? "Unspecified";
    const chapter = question.chapter ?? "Unspecified";
    const topic = question.topic ?? "Unspecified";
    const difficulty = question.difficultyLevel ?? "medium";
    const archetypeKey = question.archetypeKey ?? "Unspecified";

    addQuestion(bucket(subjectBuckets, subject, { name: subject }), question, answer);
    addQuestion(bucket(chapterBuckets, [subject, chapter].join("::"), { name: chapter }), question, answer);
    addQuestion(
      bucket(topicBuckets, [subject, chapter, topic].join("::"), {
        name: topic,
        subject,
        chapter,
        topic,
      }),
      question,
      answer,
    );
    addQuestion(bucket(difficultyBuckets, difficulty, { name: difficulty }), question, answer);
    addQuestion(bucket(archetypeBuckets, archetypeKey, { name: archetypeKey }), question, answer);
    (question.mistakeTags ?? []).forEach((tag) => {
      addQuestion(bucket(mistakeBuckets, tag, { name: tag }), question, answer);
    });
  });

  const topicAnalysis = [...topicBuckets.values()].map(toTopicAnalysis);
  const weakAreas = sortWeakTopics(topicAnalysis).slice(0, 5);
  const strongestTopics = sortStrongTopics(topicAnalysis).slice(0, 5);
  const estimatedSolveTime = allQuestionIds.reduce(
    (sum, questionId) => sum + (exam.questions[questionId].estimatedSolveTimeSeconds ?? 0),
    0,
  );

  return {
    topicAnalysis,
    subjectBreakdown: [...subjectBuckets.values()].map(toBreakdown),
    difficultyBreakdown: [...difficultyBuckets.values()].map(toBreakdown),
    chapterBreakdown: [...chapterBuckets.values()].map(toBreakdown),
    archetypeWeaknesses: [...archetypeBuckets.values()]
      .map(toBreakdown)
      .sort((a, b) => a.accuracy - b.accuracy || b.incorrect - a.incorrect)
      .slice(0, 5),
    chapterTrends: [...chapterBuckets.values()].map(toBreakdown),
    topicMasteryProgression: sortStrongTopics(topicAnalysis),
    mistakePatterns: [...mistakeBuckets.values()]
      .map(toBreakdown)
      .sort((a, b) => b.incorrect - a.incorrect || a.accuracy - b.accuracy),
    weakAreas,
    strongestTopics,
    suggestedRevisionTopics: weakAreas.map((topic) =>
      [topic.subject, topic.chapter, topic.topic].join(" / "),
    ),
    averageSolveTimeSeconds:
      allQuestionIds.length === 0 ? 0 : Math.round(estimatedSolveTime / allQuestionIds.length),
  };
}
