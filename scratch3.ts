import { parseExamDefinition } from "./src/lib/validation/exam-schema";

const payload = {
  id: "e1",
  title: "T1",
  subtitle: "S1",
  examType: "JEE_MAIN",
  durationMinutes: 180,
  totalQuestions: 1,
  sections: [
    { id: "s1", name: "Math", questionIds: ["q1"] }
  ],
  questions: {
    "q1": {
      id: "q1",
      sectionId: "s1",
      number: 1,
      type: "MCQ_SINGLE",
      text: "", // EMPTY TEXT!
      options: [
        { id: "o1", label: "A", text: "" }
      ],
      marks: 4,
      negativeMarks: 1
    }
  },
  instructions: [],
  scheduledAt: new Date().toISOString()
};

const res = parseExamDefinition(payload);
console.log("Exam Schema Parse Result:", res.success ? "SUCCESS" : res.error);
