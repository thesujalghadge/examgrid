function validateSolution(text: string, expectedAnswer: string, questionText: string = "") {
  if (!text || text.length < 50) return { passed: false, reason: "Response too short or empty" };
  
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount > 120) return { passed: false, reason: `Output exceeds 120 words (${wordCount} words)` };

  if (!text.includes("**Final Answer:**")) return { passed: false, reason: "Missing **Final Answer:** structure" };

  const finalAnswerBlock = text.split("**Final Answer:**")[1];
  if (!finalAnswerBlock || finalAnswerBlock.trim() === "") return { passed: false, reason: "Final Answer missing" };

  const containsAnswer = finalAnswerBlock.includes(expectedAnswer);
  if (!containsAnswer) {
    return { passed: false, reason: `Teacher answer contradicts Gemini answer: Expected ${expectedAnswer}` };
  }

  const fillerPhrases = ["the image shows", "based on the image", "the provided image", "in the image", "this image"];
  const lowerText = text.toLowerCase();
  for (const phrase of fillerPhrases) {
    if (lowerText.includes(phrase)) {
      return { passed: false, reason: `Output contains image-description filler: "${phrase}"` };
    }
  }

  // Phase 2 simple heuristic: Unrelated concepts (Geometry vs Arithmetic)
  const lowerQ = questionText.toLowerCase();
  const hasGeo = lowerQ.includes("circle") || lowerQ.includes("parabola") || lowerQ.includes("ellipse");
  if (hasGeo && !lowerText.includes("equation") && !lowerText.includes("point") && !lowerText.includes("coordinate")) {
     // Wait, it might just be a simple math calculation. Let's make it lenient.
     if (lowerText.includes("arithmetic") || lowerText.includes("sum is") || lowerText.includes("divide")) {
       return { passed: false, reason: "Output clearly references unrelated concepts (geometry vs arithmetic)" };
     }
  }

  return { passed: true, reason: null };
}

// Ensure the tests are padded to bypass the 50 char minimum if needed, 
// or let it fail on short length if applicable.

const cases = [
  {
    name: "Case 1: Garbage arithmetic on a Parabola question",
    q: "Find the focus of the parabola y^2 = 4ax.",
    text: "The image shows 10 ÷ 2 = 5. So we divide and get the final answer. This is just filler text to reach the minimum length of fifty characters required by the validation function.",
    expectedKey: "Option B"
  },
  {
    name: "Case 2: Missing Final Answer block",
    q: "Find the center of the circle.",
    text: "To find the center of the circle, we must complete the square for x and y. Then we identify the coordinates. The center is at (2, -3). This is just filler text to reach the fifty character minimum.",
    expectedKey: "(2, -3)"
  },
  {
    name: "Case 3: Final Answer block contradicts teacher key",
    q: "Solve for x.",
    text: "We solve the quadratic equation using the formula. The roots are 5 and -2. Since x must be positive, x = 5. **Final Answer:** x = 5",
    expectedKey: "x = -2"
  },
  {
    name: "Case 4: Perfect Solution",
    q: "What is the capital of France?",
    text: "**Approach:** Recognize the geographic fact about European capitals.\n**Calculation:** Look up France's capital.\n**Final Answer:** Paris",
    expectedKey: "Paris"
  },
  {
    name: "Case 5: Image Filler Phrase",
    q: "Identify the force.",
    text: "The provided image shows a block on an inclined plane. We use Newton's second law to find the acceleration and net force. **Final Answer:** 50N",
    expectedKey: "50N"
  }
];

cases.forEach(c => {
  console.log(`\n--- ${c.name} ---`);
  const res = validateSolution(c.text, c.expectedKey, c.q);
  console.log(`Status: ${res.passed ? 'ACCEPTED' : 'REJECTED'}`);
  if (!res.passed) {
    console.log(`failure_stage: VALIDATION`);
    console.log(`failure_reason: ${res.reason}`);
  }
});
