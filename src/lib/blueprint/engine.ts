import { weightedQuestionSelection } from "@/lib/question-intelligence/utils";
import type { ExamBlueprint } from "@/lib/blueprint/schema";
import { examBlueprintSchema } from "@/lib/blueprint/schema";
import type { BankQuestion, QuestionDifficulty } from "@/types/question-bank";

export interface BlueprintAnalysis {
  totalAvailable: number;
  filteredAvailable: number;
  subjectAvailability: Record<string, number>;
  topicAvailability: Record<string, number>;
  difficultyAvailability: Record<QuestionDifficulty, number>;
  sourceTypeAvailability: Record<string, number>;
  missingSubjectTargets: string[];
  missingTopicTargets: string[];
  diagnostics: string[];
}

export interface BlueprintSelectionResult {
  blueprint: ExamBlueprint;
  selectedQuestions: BankQuestion[];
  unmetTargets: string[];
  analysis: BlueprintAnalysis;
}

function topicKey(question: Pick<BankQuestion, "subject" | "chapter" | "topic">): string {
  return [question.subject, question.chapter, question.topic].join(" / ");
}

function matchesTopicTarget(
  question: BankQuestion,
  target: ExamBlueprint["topicDistribution"][number],
): boolean {
  if (question.subject !== target.subject) return false;
  if (target.chapter && question.chapter !== target.chapter) return false;
  if (target.topic && question.topic !== target.topic) return false;
  return true;
}

function removeSelected(pool: BankQuestion[], selected: BankQuestion[]): BankQuestion[] {
  const selectedIds = new Set(selected.map((question) => question.id));
  return pool.filter((question) => !selectedIds.has(question.id));
}

function blueprintPool(blueprint: ExamBlueprint, bank: BankQuestion[]): BankQuestion[] {
  return bank.filter((question) => {
    if (blueprint.pyqOnly || blueprint.mockType === "pyq_only") {
      if (question.sourceType !== "PYQ") return false;
    }
    if (
      blueprint.sourceTypes.length > 0 &&
      !blueprint.sourceTypes.includes(question.sourceType)
    ) {
      return false;
    }
    return true;
  });
}

export function analyzeBlueprint(
  blueprintInput: ExamBlueprint,
  bank: BankQuestion[],
): BlueprintAnalysis {
  const blueprint = examBlueprintSchema.parse(blueprintInput);
  const filteredBank = blueprintPool(blueprint, bank);
  const subjectAvailability: Record<string, number> = {};
  const topicAvailability: Record<string, number> = {};
  const sourceTypeAvailability: Record<string, number> = {};
  const difficultyAvailability: Record<QuestionDifficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  filteredBank.forEach((question) => {
    subjectAvailability[question.subject] =
      (subjectAvailability[question.subject] ?? 0) + 1;
    topicAvailability[topicKey(question)] =
      (topicAvailability[topicKey(question)] ?? 0) + 1;
    difficultyAvailability[question.difficultyLevel]++;
    sourceTypeAvailability[question.sourceType] =
      (sourceTypeAvailability[question.sourceType] ?? 0) + 1;
  });

  const missingSubjectTargets = Object.entries(blueprint.subjectWeightage)
    .filter(([subject, count]) => (subjectAvailability[subject] ?? 0) < count)
    .map(([subject]) => subject);
  const missingTopicTargets = blueprint.topicDistribution
    .filter((target) => filteredBank.filter((question) => matchesTopicTarget(question, target)).length < target.questionCount)
    .map((target) => [target.subject, target.chapter, target.topic].filter(Boolean).join(" / "));

  return {
    totalAvailable: bank.length,
    filteredAvailable: filteredBank.length,
    subjectAvailability,
    topicAvailability,
    difficultyAvailability,
    sourceTypeAvailability,
    missingSubjectTargets,
    missingTopicTargets,
    diagnostics: [
      filteredBank.length < blueprint.totalQuestions
        ? `Only ${filteredBank.length} eligible questions for ${blueprint.totalQuestions} requested.`
        : "",
      missingSubjectTargets.length > 0
        ? `Subject shortfalls: ${missingSubjectTargets.join(", ")}`
        : "",
      missingTopicTargets.length > 0
        ? `Topic shortfalls: ${missingTopicTargets.join(", ")}`
        : "",
    ].filter(Boolean),
  };
}

export function selectQuestionsFromBlueprint(
  blueprintInput: ExamBlueprint,
  bank: BankQuestion[],
): BlueprintSelectionResult {
  const blueprint = examBlueprintSchema.parse(blueprintInput);
  const analysis = analyzeBlueprint(blueprint, bank);
  const selected: BankQuestion[] = [];
  const unmetTargets: string[] = [];
  let pool = blueprintPool(blueprint, bank);

  for (const target of blueprint.topicDistribution) {
    const matches = pool.filter((question) => matchesTopicTarget(question, target));
    const picked = weightedQuestionSelection(matches, target.questionCount);
    selected.push(...picked);
    pool = removeSelected(pool, picked);
    if (picked.length < target.questionCount) {
      unmetTargets.push(
        `Topic target shortfall: ${[target.subject, target.chapter, target.topic]
          .filter(Boolean)
          .join(" / ")} (${picked.length}/${target.questionCount})`,
      );
    }
  }

  for (const [subject, count] of Object.entries(blueprint.subjectWeightage)) {
    const alreadySelected = selected.filter((question) => question.subject === subject).length;
    const remainingTarget = Math.max(0, count - alreadySelected);
    if (remainingTarget === 0) continue;
    const matches = pool.filter((question) => question.subject === subject);
    const picked = weightedQuestionSelection(matches, remainingTarget);
    selected.push(...picked);
    pool = removeSelected(pool, picked);
    if (picked.length < remainingTarget) {
      unmetTargets.push(`Subject target shortfall: ${subject} (${picked.length}/${remainingTarget})`);
    }
  }

  const difficultyRemaining = { ...blueprint.difficultyBalance };
  selected.forEach((question) => {
    difficultyRemaining[question.difficultyLevel] = Math.max(
      0,
      difficultyRemaining[question.difficultyLevel] - 1,
    );
  });

  (Object.keys(difficultyRemaining) as QuestionDifficulty[]).forEach((difficulty) => {
    const count = difficultyRemaining[difficulty];
    if (count <= 0) return;
    const matches = pool.filter((question) => question.difficultyLevel === difficulty);
    const picked = weightedQuestionSelection(matches, count);
    selected.push(...picked);
    pool = removeSelected(pool, picked);
    if (picked.length < count) {
      unmetTargets.push(`Difficulty target shortfall: ${difficulty} (${picked.length}/${count})`);
    }
  });

  if (selected.length < blueprint.totalQuestions) {
    const remainingTarget = blueprint.totalQuestions - selected.length;
    const picked = weightedQuestionSelection(pool, remainingTarget);
    selected.push(...picked);
    if (picked.length < remainingTarget) {
      unmetTargets.push(`Total question target shortfall: ${selected.length}/${blueprint.totalQuestions}`);
    }
  }

  return {
    blueprint,
    selectedQuestions: selected.slice(0, blueprint.totalQuestions),
    unmetTargets,
    analysis,
  };
}

export function createChapterMockBlueprint({
  id,
  title,
  examType = "JEE_MAIN",
  subject,
  chapter,
  questionCount,
  difficultyBalance,
  pyqOnly = false,
}: {
  id: string;
  title: string;
  examType?: ExamBlueprint["examType"];
  subject: string;
  chapter: string;
  questionCount: number;
  difficultyBalance: ExamBlueprint["difficultyBalance"];
  pyqOnly?: boolean;
}): ExamBlueprint {
  return examBlueprintSchema.parse({
    id,
    title,
    examType,
    mockType: "chapter",
    totalQuestions: questionCount,
    subjectWeightage: { [subject]: questionCount },
    topicDistribution: [{ subject, chapter, questionCount }],
    difficultyBalance,
    pyqOnly,
  });
}

export function createTopicMockBlueprint({
  id,
  title,
  examType = "JEE_MAIN",
  subject,
  chapter,
  topic,
  questionCount,
  difficultyBalance,
  pyqOnly = false,
}: {
  id: string;
  title: string;
  examType?: ExamBlueprint["examType"];
  subject: string;
  chapter: string;
  topic: string;
  questionCount: number;
  difficultyBalance: ExamBlueprint["difficultyBalance"];
  pyqOnly?: boolean;
}): ExamBlueprint {
  return examBlueprintSchema.parse({
    id,
    title,
    examType,
    mockType: "topic",
    totalQuestions: questionCount,
    subjectWeightage: { [subject]: questionCount },
    topicDistribution: [{ subject, chapter, topic, questionCount }],
    difficultyBalance,
    pyqOnly,
  });
}
