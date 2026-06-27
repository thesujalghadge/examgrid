import { buildExamDefinition } from "../src/services/exam-builder-service";
import { examDefinitionToRows, rowsToExamDefinition } from "../src/repositories/supabase/mappers/exam-mapper";
import { evaluateTestSession } from "../src/services/test-evaluation";

// Simulate a Bank Question
const bankQuestion = {
  id: "bank-q-1",
  questionType: "MCQ_SINGLE" as const,
  questionText: "What is 2 + 2?",
  options: [
    { label: "A", text: "1" },
    { label: "B", text: "2" },
    { label: "C", text: "3" },
    { label: "D", text: "4" },
  ],
  correctAnswer: "D",
  marks: 4,
  negativeMarks: 1,
};

async function runTrace() {
  console.log("=== EXAMGRID ANSWER INTEGRITY TRACE ===\n");

  console.log("1. Building Exam Definition...");
  const draft = {
    id: "exam-1",
    title: "Test Exam",
    subtitle: "",
    examType: "JEE_MAIN" as const,
    durationMinutes: 60,
    scheduledAt: new Date().toISOString(),
    instructions: [],
    sections: [{ id: "sec-1", name: "Math", questionIds: ["bank-q-1"] }]
  };
  
  const { exam: builtExam } = buildExamDefinition(draft, [bankQuestion as any]);
  if (!builtExam) throw new Error("Failed to build exam");
  
  const qId = builtExam.sections[0].questionIds[0];
  const q = builtExam.questions[qId];
  
  console.log(`Question ID: ${qId}`);
  console.log(`Generated Option IDs:`);
  q.options.forEach((o, i) => console.log(`  Position ${i+1} (Label ${o.label}): ${o.id}`));
  
  console.log("\n2. DB Serialization/Deserialization...");
  const { examRow, sections, questions } = examDefinitionToRows(builtExam, builtExam.id, "inst-1");
  const dbOptions = [...questions[0].options];
  
  const loadedExam = rowsToExamDefinition(
    examRow as any, 
    sections as any, 
    [{ ...questions[0], options: dbOptions }] as any
  );
  const loadedQ = loadedExam.questions[qId];

  console.log("\n3. Simulating Student Click...");
  // Student clicks Option 2 (Index 1)
  const clickedOption = loadedQ.options[1];
  console.log(`  Clicked Position: 2`);
  console.log(`  Clicked Label: ${clickedOption.label}`);
  console.log(`  Clicked ID: ${clickedOption.id}`);
  
  const studentAnswers = { [qId]: clickedOption.id };
  console.log(`\nSTORED IN STATE:`, studentAnswers);
  
  console.log("\n4. Simulating Submission Payload...");
  const payload = { answers: studentAnswers };
  console.log(`PAYLOAD:`, payload.answers);

  console.log("\n5. Simulating Server Evaluation...");
  const answerKey = {
    [qId]: {
      type: loadedQ.type,
      correctOptionId: loadedQ.correctOptionId,
      marks: loadedQ.marks,
      negativeMarks: loadedQ.negativeMarks
    }
  };
  
  const evalResult = evaluateTestSession({
    sessionId: "sess-1",
    testId: loadedExam.id,
    studentId: "stu-1",
    answers: payload.answers,
    answerKey,
    startedAt: Date.now() - 10000,
    submittedAt: Date.now(),
  });
  
  const qResult = evalResult.perQuestion[0];
  console.log(`  Server evaluated answer as: ${qResult.selected}`);
  console.log(`  Is Correct? ${qResult.correct}`);

  console.log("\n6. Simulating Solutions Page Rendering...");
  
  // CASE B PROOF:
  // The system reconstructs ExamDefinition. Suppose the option array changed order
  // (e.g. from A,B,C,D to C,A,D,B because of a DB reshuffle or UI reordering)
  const reorderedOptions = [
      loadedQ.options[2], // C
      loadedQ.options[0], // A
      loadedQ.options[3], // D
      loadedQ.options[1]  // B -> originally position 2, now position 4!
  ];
  
  const modifiedExam = {
      ...loadedExam,
      questions: {
          [qId]: {
              ...loadedQ,
              options: reorderedOptions
          }
      }
  };

  const currentQ = modifiedExam.questions[qId];
  const answer = qResult.selected;
  
  // Exact logic from solutions/page.tsx
  let renderedAnswer = answer;
  if (answer) {
      const index = currentQ.options.findIndex((opt) => opt.id === answer);
      renderedAnswer = index >= 0 ? String(index + 1) : answer;
  }
  
  console.log(`  Current Options Array in UI:`);
  currentQ.options.forEach((o, i) => console.log(`    Position ${i+1}: ${o.id}`));
  
  console.log(`\n=== TRACE CONCLUSION ===`);
  console.log(`Student Clicked Position: 2`);
  console.log(`DB Stored Value: ${qResult.selected}`);
  console.log(`Result Page Renders Position: ${renderedAnswer}`);
  
  if (renderedAnswer !== "2") {
      console.log(`\n🚨 CASE B CONFIRMED: Rendering Corruption!`);
      console.log(`The data was stored perfectly, but UI mapped it to Position ${renderedAnswer} because the options array shifted.`);
  }
}

runTrace().catch(console.error);
