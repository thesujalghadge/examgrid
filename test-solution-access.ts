import { verifyAndFetchSolution } from "./src/app/student/actions/solution-access";

async function run() {
  const result = await verifyAndFetchSolution(
    "da368ae6-633e-4665-9fb1-44bf37ded332", // instituteId
    "cdd18c53-f23a-4622-9063-705ec88b3692", // testId
    "12345", // studentRoll - wait I need a valid roll
    "cdd18c53-f23a-4622-9063-705ec88b3692-question-1", // questionId
    true
  );
  console.log(JSON.stringify(result, null, 2));
}

run();
