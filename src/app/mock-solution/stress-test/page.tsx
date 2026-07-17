"use client";

import SolutionCard from "@/components/student/solution/SolutionCard";
import LegacySolutionRenderer from "@/components/student/solution/LegacySolutionRenderer";
import "katex/dist/katex.min.css";

/**
 * Stress test page for solution renderers.
 * Tests all edge cases: null fields, empty arrays, long equations, legacy data.
 * Access at: /mock-solution/stress-test
 */

// ─── Case 1: Logic Gate (Actual Gemini V3 Output) ─────────────────────────
const case1 = {
  "steps": [
    {
      "title": "Analyze the top branch logic",
      "result": "Y_top = 1 if A=0, B=0",
      "equation": "Y_top = \\bar{A} \\cdot \\bar{B}",
      "reasoning": "The inputs A and B pass through NOT gates, then into an AND gate. For the output of this branch to be 1, both NOT gates must output 1, requiring A=0 and B=0."
    },
    {
      "title": "Analyze the bottom branch logic",
      "result": "Y_bottom = 1 if C=0, D=0",
      "equation": "Y_bottom = \\overline{C + D}",
      "reasoning": "The inputs C and D enter a NOR gate. The output is 1 only when both inputs are 0."
    },
    {
      "title": "Determine the condition for LED glow",
      "result": "null",
      "equation": "Y = (\\bar{A} \\cdot \\bar{B}) \\cdot (\\overline{C + D})",
      "reasoning": "The circuit structure implies that both branches must provide a high potential difference across the LED. Examining option (D) 1101 where A=1, B=1, C=0, D=1, let's verify if the logic state yields the output."
    }
  ],
  "topic": "Semiconductor Electronics",
  "keyIdea": "An LED glows when it is forward biased by a high voltage (logic 1). The logic circuit determines the output state based on the inputs A, B, C, and D through a combination of NOT, AND, and NOR gates.",
  "subject": "Physics",
  "shortcut": "Test the options directly into the circuit diagram: logic 1 at inputs into NOT gates becomes 0, rendering AND gate output 0, while NOR gate with 0 at input C and 1 at D produces 0, which is incorrect for specific logic configurations; however, verifying given truth values ensures the correct state match for high output logic.",
  "subtopic": "Logic Gates",
  "takeaway": "For logic gate problems, evaluate each sub-circuit individually and check the truth table of the final gate.",
  "notations": [
    {
      "symbol": "A, B, C, D",
      "meaning": "Binary input signals"
    },
    {
      "symbol": "Y",
      "meaning": "Final output signal"
    }
  ],
  "difficulty": "Medium",
  "finalAnswer": {
    "value": "1101",
    "option": "D"
  },
  "generatedAt": "2026-06-30T15:23:18.443Z",
  "conceptChips": [
    "Logic Gates",
    "Digital Electronics",
    "Boolean Algebra"
  ],
  "qualityScore": {
    "clarity": 10,
    "pedagogy": 9,
    "finalScore": 9.5,
    "repetition": 10,
    "conciseness": 10,
    "notationConsistency": 8
  },
  "questionType": "MCQ",
  "promptVersion": "solution-v3",
  "schemaVersion": 3,
  "generatorModel": "gemini-3.1-flash-lite",
  "primaryConcept": "Boolean expression evaluation",
  "validationStatus": "pending",
  "validation_status": "PASSED",
  "estimatedSolveTime": "2 min"
};

// ─── Case 2: Interference (Actual Gemini V3 Output) ─────────────────────────
const case2 = {
  "steps": [
    {
      "title": "Calculate path difference at initial and final positions",
      "result": "50 - 44.72 = 5.28 m",
      "equation": "\\Delta x = \\sqrt{40^2 + (5+25)^2} - \\sqrt{40^2 + (5-25)^2} = \\sqrt{40^2 + 30^2} - \\sqrt{40^2 + (-20)^2}",
      "reasoning": "The path difference at any point is the difference in distances from the two speakers. At point A (center), the distance is equal, making path difference 0. After moving 25m, we use the Pythagorean theorem."
    },
    {
      "title": "Relate path difference to interference cycles",
      "result": "λ = 0.528 m",
      "equation": "\\Delta x = n \\lambda",
      "reasoning": "The recorder passes 10 cycles of minima and maxima. One full cycle of interference corresponds to a path difference change of one wavelength."
    },
    {
      "title": "Calculate the frequency",
      "result": "600 Hz",
      "equation": "f = \\frac{v}{\\lambda}",
      "reasoning": "Use the wave speed formula to determine the frequency from the wavelength."
    }
  ],
  "topic": "Waves",
  "keyIdea": "Interference occurs due to the path difference between waves from two coherent sources. As the recorder moves, the path difference changes, causing a series of constructive (maxima) and destructive (minima) interference points.",
  "subject": "Physics",
  "shortcut": "The path difference at displacement x is approximated by x*(d/D) if x is small, but given the geometry, direct path calculation is more reliable here to avoid error from approximation limits.",
  "subtopic": "Interference of Sound Waves",
  "takeaway": "Total path difference divided by the number of cycles equals the signal wavelength.",
  "notations": [
    {
      "symbol": "\\Delta x",
      "meaning": "Path difference between sound waves"
    },
    {
      "symbol": "n",
      "meaning": "Number of interference cycles"
    },
    {
      "symbol": "\\lambda",
      "meaning": "Wavelength of the sound wave"
    },
    {
      "symbol": "f",
      "meaning": "Frequency of the input signal"
    },
    {
      "symbol": "v",
      "meaning": "Speed of sound"
    }
  ],
  "difficulty": "Medium",
  "finalAnswer": {
    "value": "600"
  },
  "generatedAt": "2026-06-30T15:23:05.602Z",
  "conceptChips": [
    "Interference",
    "Path Difference",
    "Superposition Principle"
  ],
  "qualityScore": {
    "clarity": 10,
    "pedagogy": 9,
    "finalScore": 9.8,
    "repetition": 10,
    "conciseness": 10,
    "notationConsistency": 10
  },
  "questionType": "NAT",
  "promptVersion": "solution-v3",
  "schemaVersion": 3,
  "generatorModel": "gemini-3.1-flash-lite",
  "primaryConcept": "Path Difference in Interference",
  "validationStatus": "pending",
  "validation_status": "PASSED",
  "estimatedSolveTime": "3 min"
};

// ─── Case 3: notations = [] (no equations) ──────────────────────────────────
const case3 = {
  keyIdea: "In assertion-reasoning questions, evaluate each statement independently before checking the causal link.",
  conceptChips: ["Assertion Reasoning", "Logical Analysis"],
  notations: [],
  steps: [
    { title: "Evaluate Assertion", reasoning: "The assertion states that noble gases are inert. This is true — they have complete octets.", equation: null, result: "Assertion: TRUE" },
    { title: "Evaluate Reason", reasoning: "The reason states noble gases have 8 valence electrons. This is true for all except Helium (2 electrons).", equation: null, result: "Reason: TRUE (with exception)" },
    { title: "Check causal link", reasoning: "The stability of noble gases IS caused by their filled outer shell. The reason correctly explains the assertion.", equation: null, result: null },
  ],
  finalAnswer: { value: "Both A and R are true, and R is the correct explanation of A", option: "A" },
  importantObservation: "Helium has only 2 valence electrons but is still inert because its 1s shell is complete.",
  commonMistakes: [
    "Assuming all noble gases have exactly 8 valence electrons (Helium has 2).",
    "Not checking the causal relationship between assertion and reason.",
  ],
  shortcut: null,
  takeaway: "Always check: (1) Is A true? (2) Is R true? (3) Does R explain A?",
  assumptions: null,
  subject: "Chemistry",
  topic: "Periodic Table",
  subtopic: "Noble Gases",
  difficulty: "Medium" as const,
  questionType: "MCQ",
  primaryConcept: "Noble Gas Stability",
  estimatedSolveTime: "2 min",
  schemaVersion: 3,
  promptVersion: "solution-v3" as const,
  generatedAt: new Date().toISOString(),
  generatorModel: "gemini-3.1-flash-lite",
  validationStatus: "PASSED",
};

// ─── Case 4: shortcut = null, full solution with assumptions ────────────────
const case4 = {
  keyIdea: "Young's double slit experiment produces interference patterns. The fringe width depends on wavelength, slit separation, and screen distance.",
  conceptChips: ["Wave Optics", "Interference", "Young's Double Slit", "Fringe Width"],
  notations: [
    { symbol: "d", meaning: "slit separation" },
    { symbol: "D", meaning: "screen distance" },
    { symbol: "\\lambda", meaning: "wavelength of light" },
    { symbol: "\\beta", meaning: "fringe width" },
  ],
  steps: [
    { title: "Write fringe width formula", reasoning: "The fringe width in YDSE is the distance between consecutive bright fringes.", equation: "\\beta = \\frac{\\lambda D}{d}", result: null },
    { title: "Substitute values", reasoning: "Given λ = 600 nm = 6×10⁻⁷ m, D = 1 m, d = 0.3 mm = 3×10⁻⁴ m.", equation: "\\beta = \\frac{6 \\times 10^{-7} \\times 1}{3 \\times 10^{-4}}", result: null },
    { title: "Calculate", reasoning: "Divide to get the fringe width in meters, then convert to mm.", equation: "\\beta = 2 \\times 10^{-3} \\text{ m} = 2 \\text{ mm}", result: "β = 2 mm" },
  ],
  finalAnswer: { value: "2 mm", option: "C" },
  importantObservation: "If the experiment is done in water (n = 4/3), the wavelength decreases and fringe width reduces by factor n.",
  commonMistakes: [
    "Forgetting to convert nm to m or mm to m before substituting.",
    "Confusing slit separation (d) with slit width — they are different quantities.",
    "Using the formula for single slit diffraction instead of double slit interference.",
  ],
  shortcut: null,
  takeaway: "β = λD/d — fringe width is directly proportional to wavelength and screen distance.",
  assumptions: [
    { assumption: "Small angle approximation (sin θ ≈ tan θ ≈ θ)", validity: "When d << D (slit separation much smaller than screen distance)", failure: "When slits are wide or screen is very close" },
    { assumption: "Monochromatic coherent source", validity: "When using a laser or filtered light", failure: "White light produces colored fringes with different widths for each wavelength" },
  ],
  subject: "Physics",
  topic: "Wave Optics",
  subtopic: "Young's Double Slit Experiment",
  difficulty: "Hard" as const,
  questionType: "MCQ",
  primaryConcept: "Interference Pattern",
  estimatedSolveTime: "3 min",
  schemaVersion: 3,
  promptVersion: "solution-v3" as const,
  generatedAt: new Date().toISOString(),
  generatorModel: "gemini-3.1-flash-lite",
  validationStatus: "PASSED",
};

// ─── Case 5: Very long equations (math-heavy) ──────────────────────────────
const case5 = {
  keyIdea: "Integrate the probability density function over the given interval. For continuous distributions, P(a < X < b) = ∫f(x)dx from a to b.",
  conceptChips: ["Probability", "Integration", "Continuous Distribution", "PDF"],
  notations: [
    { symbol: "f(x)", meaning: "probability density function" },
    { symbol: "F(x)", meaning: "cumulative distribution function" },
  ],
  steps: [
    { title: "Write the integral", reasoning: "The probability is the area under the PDF curve between the limits.", equation: "P(1 < X < 3) = \\int_{1}^{3} \\frac{x^2}{9} \\, dx", result: null },
    { title: "Evaluate the integral", reasoning: "Apply the power rule for integration: ∫x²dx = x³/3.", equation: "= \\left[ \\frac{x^3}{27} \\right]_{1}^{3} = \\frac{3^3}{27} - \\frac{1^3}{27} = \\frac{27 - 1}{27} = \\frac{26}{27}", result: "P = 26/27" },
    { title: "Cross-check with matrix form", reasoning: "For verification, the transition matrix in the general case would be:", equation: "\\mathbf{M} = \\begin{pmatrix} \\frac{1}{27} & \\frac{8}{27} & \\frac{18}{27} \\\\ 0 & \\frac{26}{27} & \\frac{1}{27} \\\\ \\frac{7}{27} & \\frac{19}{27} & \\frac{1}{27} \\end{pmatrix}", result: null },
    { title: "Verify with summation", reasoning: "Sum of all probabilities over the entire support should equal 1.", equation: "\\sum_{i=1}^{n} P(X = x_i) = \\int_{0}^{3} \\frac{x^2}{9} dx = \\left[ \\frac{x^3}{27} \\right]_0^3 = 1 \\quad \\checkmark", result: "Verified: total probability = 1" },
  ],
  finalAnswer: { value: "26/27", option: null },
  importantObservation: null,
  commonMistakes: [
    "Forgetting the constant of normalization in the PDF.",
    "Using wrong integration limits.",
  ],
  shortcut: "Use CDF directly: P(1 < X < 3) = F(3) - F(1) to avoid computing the integral.",
  takeaway: "For continuous distributions, always integrate the PDF. Check normalization as a sanity test.",
  assumptions: null,
  subject: "Mathematics",
  topic: "Probability",
  subtopic: "Continuous Random Variables",
  difficulty: "Hard" as const,
  questionType: "NAT",
  primaryConcept: "Integration of PDF",
  estimatedSolveTime: "4 min",
  schemaVersion: 3,
  promptVersion: "solution-v3" as const,
  generatedAt: new Date().toISOString(),
  generatorModel: "gemini-3.1-flash-lite",
  validationStatus: "PASSED",
};

// ─── Case 6: Legacy V1 data ────────────────────────────────────────────────
const legacyV1 = {
  subject: "Physics",
  topic: "Rotational Motion",
  subtopic: "Torque",
  difficulty: "MEDIUM",
  question_type: "MCQ",
  primary_concept: "Torque and Angular Acceleration",
  secondary_concept: "Moment of Inertia",
  quick_approach: "Use τ = Iα to find angular acceleration, then use ω = αt for final angular velocity.",
  essential_steps: [
    "Calculate moment of inertia: $I = \\frac{1}{2}mr^2 = \\frac{1}{2}(2)(0.5)^2 = 0.25$ kg⋅m²",
    "Find angular acceleration: $\\alpha = \\frac{\\tau}{I} = \\frac{5}{0.25} = 20$ rad/s²",
    "Calculate final velocity: $\\omega = \\alpha t = 20 \\times 3 = 60$ rad/s",
  ],
  final_answer: "60 rad/s",
  prompt_version: "solution-v1",
  validation_status: "PASSED",
};

export default function StressTestPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fa] p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Solution Renderer Stress Test</h1>
        <p className="text-sm text-slate-500 mb-8">Edge cases for V3 + Legacy renderers. Verify: no crashes, no gaps, no broken KaTeX.</p>

        <div className="space-y-8">
          {/* Logic Gate Case */}
          <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Logic Gate (Exam Mode)</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SolutionCard meta={case1} hasAttempted={true} studentAnswer="Option C" correctAnswer="Option D" isCorrect={false} mode="EXAM" />
            </div>
          </section>

          <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Logic Gate (Learn Mode)</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SolutionCard meta={case1} hasAttempted={true} studentAnswer="Option C" correctAnswer="Option D" isCorrect={false} mode="LEARN" />
            </div>
          </section>

          {/* Interference Case */}
          <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Interference (Exam Mode)</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SolutionCard meta={case2} hasAttempted={false} studentAnswer={null} correctAnswer="Option B" isCorrect={false} mode="EXAM" />
            </div>
          </section>
          
          <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Interference (Learn Mode)</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SolutionCard meta={case2} hasAttempted={false} studentAnswer={null} correctAnswer="Option B" isCorrect={false} mode="LEARN" />
            </div>
          </section>

          {/* Case 4 */}
          <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Case 4: Full solution with assumptions, 3 common mistakes, no shortcut</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SolutionCard meta={case4} hasAttempted={true} studentAnswer="Option C" correctAnswer="Option C" isCorrect={true} />
            </div>
          </section>

          {/* Case 5 */}
          <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Case 5: Very long equations (matrices, integrals, summations) + NAT type</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <SolutionCard meta={case5} hasAttempted={true} studentAnswer="25/27" correctAnswer="26/27" isCorrect={false} />
            </div>
          </section>

          {/* Case 6 */}
          <section>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3">Case 6: Legacy V1 solution (backwards compatibility)</h2>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <LegacySolutionRenderer meta={legacyV1} contentMarkdown="**Approach:** Use τ = Iα\n\n**Steps:**\n* I = ½mr² = 0.25 kg⋅m²\n* α = τ/I = 20 rad/s²\n* ω = αt = 60 rad/s\n\n**Answer:** 60 rad/s" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
