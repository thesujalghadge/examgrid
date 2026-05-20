import type { ExamDefinition, ExamQuestion } from "@/types/exam";
import type { TestSession } from "@/types/test-session";

/** Apply per-student question/option order for display; answers stay keyed by original IDs. */
export function buildShuffledExamView(
  base: ExamDefinition,
  session: Pick<TestSession, "questionOrder" | "optionOrderMap">,
): ExamDefinition {
  const order =
    session.questionOrder.length > 0
      ? session.questionOrder
      : base.sections.flatMap((s) => s.questionIds);

  const questions: Record<string, ExamQuestion> = {};
  for (const qid of order) {
    const q = base.questions[qid];
    if (!q) continue;
    if (q.type === "MCQ_SINGLE" && q.options.length > 0) {
      const idxs = session.optionOrderMap[qid];
      const displayOptions =
        idxs && idxs.length === q.options.length
          ? idxs.map((i) => q.options[i])
          : q.options;
      questions[qid] = { ...q, options: displayOptions };
    } else {
      questions[qid] = q;
    }
  }

  const sections = base.sections.map((sec) => ({
    ...sec,
    questionIds: order.filter((id) => questions[id]?.sectionId === sec.id),
  }));

  return {
    ...base,
    questions,
    sections,
    totalQuestions: order.filter((id) => questions[id]).length,
  };
}
