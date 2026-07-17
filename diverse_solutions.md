# Diverse Questions V3 Output

## Question 1: Physics - Mechanics
**Text:** A car starts from rest and accelerates uniformly at 2 m/s² for 10 seconds. Find the distance traveled.

### Raw AI Metadata
```json
{
  "examMode": {
    "concepts": [
      "Kinematics",
      "Uniform acceleration"
    ],
    "keyEquations": [
      "$s = ut + \\frac{1}{2}at^2$"
    ],
    "fastSteps": [
      "$u = 0, a = 2, t = 10$",
      "$s = 0 + 0.5(2)(10^2) = 100$"
    ],
    "estimatedSolveTime": "5 seconds",
    "examTricks": [
      "When $u=0$, distance is simply $\\frac{1}{2}at^2$"
    ],
    "finalAnswerSummary": "100 m"
  },
  "learnMode": {
    "keyIdea": "Distance under uniform acceleration from rest is proportional to the square of time, specifically $s = \\frac{1}{2}at^2$.",
    "steps": [
      {
        "title": "Identify kinematic variables",
        "reasoning": "List given parameters and standard SUVAT variables.",
        "equation": "$u=0, a=2, t=10$",
        "result": "Initial velocity is zero"
      },
      {
        "title": "Apply displacement formula",
        "reasoning": "Since acceleration is constant and initial velocity is zero, use the displacement equation.",
        "equation": "$s = ut + \\frac{1}{2}at^2 \\implies s = 0 + \\frac{1}{2}(2)(10^2)$",
        "result": "$s = 100 \\text{ m}$"
      }
    ],
    "takeaway": "For motion starting from rest with constant acceleration, distance traveled is $0.5 \\times \\text{acceleration} \\times \\text{time}^2$.",
    "commonMistakes": [
      "Using $v = at$ instead of displacement formula",
      "Forgetting to square the time"
    ],
    "conceptChips": [
      "Kinematics",
      "Acceleration"
    ],
    "importantObservation": "The $u=0$ condition simplifies the standard kinematic equation significantly."
  },
  "finalAnswer": {
    "value": "100 m",
    "option": "A"
  },
  "availableModes": [
    "examMode",
    "learnMode"
  ],
  "subject": "Physics",
  "topic": "Mechanics",
  "subtopic": "Kinematics",
  "difficulty": "Easy",
  "questionType": "Calculation",
  "primaryConcept": "Uniform acceleration",
  "schemaVersion": 3,
  "promptVersion": "solution-v3",
  "generatedAt": "2026-06-30T21:40:08.193Z",
  "generatorModel": "gemini-3.1-flash-lite",
  "validationStatus": "pending"
}
```

---

## Question 2: Physics - Thermodynamics
**Text:** Why is the specific heat of a gas at constant pressure (Cp) greater than its specific heat at constant volume (Cv)?

### Raw AI Metadata
```json
{
  "examMode": {
    "concepts": [
      "First Law of Thermodynamics",
      "Degrees of Freedom",
      "Work-Energy Theorem"
    ],
    "keyEquations": [
      "$Q = \\Delta U + W$",
      "$W = P\\Delta V$",
      "$C_p - C_v = R$"
    ],
    "fastSteps": [
      "Constant volume: $\\Delta V = 0 \\implies W = 0$",
      "Constant pressure: $\\Delta V > 0 \\implies W > 0$",
      "Heating at const P requires energy for $\\Delta U$ AND expansion $W$",
      "Heating at const V requires energy only for $\\Delta U$",
      "Therefore, $C_p > C_v$ due to expansion work."
    ],
    "estimatedSolveTime": "30 seconds",
    "finalAnswerSummary": "Option A"
  },
  "learnMode": {
    "keyIdea": "Energy supplied as heat at constant pressure is split between increasing internal energy and doing mechanical work on the surroundings, whereas at constant volume, all energy goes into increasing internal energy.",
    "steps": [
      {
        "title": "Energy Partitioning",
        "reasoning": "Under constant volume, no expansion occurs, so $W = 0$. By the first law, all added heat goes directly to raising temperature.",
        "equation": "$Q_v = \\Delta U$"
      },
      {
        "title": "Expansion Requirement",
        "reasoning": "Under constant pressure, the gas must push against the atmosphere to expand. This requires additional energy compared to the isochoric case.",
        "equation": "$Q_p = \\Delta U + P\\Delta V$"
      },
      {
        "title": "Comparison",
        "reasoning": "Since both processes require the same $\\Delta U$ for the same $\\Delta T$, the constant pressure process necessitates extra energy for work.",
        "result": "$C_p > C_v$"
      }
    ],
    "takeaway": "Work done during expansion at constant pressure demands extra input heat, making $C_p$ larger.",
    "conceptChips": [
      "Isochoric vs Isobaric",
      "First Law of Thermodynamics",
      "Expansion Work"
    ],
    "notations": [
      {
        "symbol": "$C_p$",
        "meaning": "Molar heat capacity at constant pressure"
      },
      {
        "symbol": "$C_v$",
        "meaning": "Molar heat capacity at constant volume"
      },
      {
        "symbol": "$W$",
        "meaning": "Mechanical work done by the gas"
      }
    ]
  },
  "finalAnswer": {
    "value": "Work is done by the gas at constant pressure",
    "option": "A"
  },
  "availableModes": [
    "examMode",
    "learnMode"
  ],
  "subject": "Physics",
  "topic": "Thermodynamics",
  "subtopic": "Specific Heat Capacities",
  "difficulty": "Easy",
  "questionType": "Conceptual",
  "primaryConcept": "Molar Heat Capacity Difference",
  "schemaVersion": 3,
  "promptVersion": "solution-v3",
  "generatedAt": "2026-06-30T21:40:11.378Z",
  "generatorModel": "gemini-3.1-flash-lite",
  "validationStatus": "pending"
}
```

---

## Question 3: Chemistry - Chemical Kinetics
**Text:** A first-order reaction has a half-life of 10 minutes. How long will it take for the concentration to reduce to 12.5% of its initial value?

### Raw AI Metadata
```json
{
  "examMode": {
    "concepts": [
      "first-order-kinetics",
      "half-life-doubling"
    ],
    "keyEquations": [
      "$12.5\\% = (1/2)^3$",
      "$t = n \\cdot t_{1/2}$"
    ],
    "fastSteps": [
      "$100\\% \\xrightarrow{10min} 50\\% \\xrightarrow{10min} 25\\% \\xrightarrow{10min} 12.5\\%$",
      "$t = 3 \\times 10 = 30$ min"
    ],
    "estimatedSolveTime": "15 seconds",
    "examTricks": [
      "Recognize 12.5% as 1/8 of initial",
      "Half-life power rule: $(1/2)^n = 1/2^n$"
    ],
    "finalAnswerSummary": "30 minutes"
  },
  "learnMode": {
    "keyIdea": "First-order reactions reduce by half every $t_{1/2}$. Use repeated halving instead of the integrated rate law for simple fractions.",
    "steps": [
      {
        "title": "Fraction conversion",
        "reasoning": "Identify the remaining fraction: $12.5\\% = 12.5/100 = 1/8$.",
        "equation": "$1/8 = (1/2)^3$"
      },
      {
        "title": "Half-life iteration",
        "reasoning": "Every $t_{1/2}$ reduces the concentration to $(1/2)^n$. Here $n=3$.",
        "equation": "$t = 3 \\cdot t_{1/2} = 3 \\cdot 10 = 30$ min"
      }
    ],
    "takeaway": "When concentration drops to $(1/2)^n$, time elapsed is simply $n \\cdot t_{1/2}$.",
    "commonMistakes": [
      "Using the full $\\ln(A_0/A_t)$ formula unnecessarily",
      "Calculating 12.5% as 1/4 instead of 1/8"
    ],
    "conceptChips": [
      "Radioactive decay",
      "Exponential decay"
    ],
    "importantObservation": "12.5% is exactly $1/2^3$, making the logarithmic formula redundant.",
    "notations": [
      {
        "symbol": "$t_{1/2}$",
        "meaning": "Time for 50% completion"
      },
      {
        "symbol": "$n$",
        "meaning": "Number of half-lives"
      }
    ]
  },
  "finalAnswer": {
    "value": "30 minutes",
    "option": "C"
  },
  "availableModes": [
    "examMode",
    "learnMode"
  ],
  "subject": "Chemistry",
  "topic": "Chemical Kinetics",
  "subtopic": "First Order Reaction",
  "difficulty": "Easy",
  "questionType": "Calculation",
  "primaryConcept": "Half-life",
  "schemaVersion": 3,
  "promptVersion": "solution-v3",
  "generatedAt": "2026-06-30T21:40:14.240Z",
  "generatorModel": "gemini-3.1-flash-lite",
  "validationStatus": "pending"
}
```

---

## Question 4: Mathematics - Calculus
**Text:** Evaluate the integral of x*sin(x) dx.

### Raw AI Metadata
```json
{
  "examMode": {
    "concepts": [
      "Integration by parts"
    ],
    "keyEquations": [
      "\\int u dv = uv - \\int v du"
    ],
    "fastSteps": [
      "Let u = x, dv = sin(x)dx",
      "du = dx, v = -cos(x)",
      "Result: -x*cos(x) - \\int -cos(x)dx",
      "-x*cos(x) + sin(x) + C"
    ],
    "estimatedSolveTime": "30 seconds",
    "examTricks": [
      "Use tabular integration (DI method) for polynomial times trig functions: D(x)=1,0; I(sin x)=-cos x, -sin x. Multiply diagonal pairs with alternating signs."
    ],
    "finalAnswerSummary": "Option A"
  },
  "learnMode": {
    "keyIdea": "Use Integration by Parts to break the product by assigning the polynomial to be differentiated.",
    "steps": [
      {
        "title": "Selection",
        "reasoning": "Identify $u$ as the function that simplifies upon differentiation and $dv$ as the function that is easily integrated.",
        "equation": "$u=x, dv=\\sin(x)dx$"
      },
      {
        "title": "Application",
        "reasoning": "Differentiate $u$ and integrate $dv$ to apply the formula.",
        "equation": "$du=dx, v=-\\cos(x)$"
      },
      {
        "title": "Evaluation",
        "reasoning": "Substitute into the formula $uv - \\int v du$.",
        "equation": "$x(-\\cos x) - \\int (-\\cos x)dx = -x\\cos x + \\int \\cos x dx$",
        "result": "-x\\cos x + \\sin x + C"
      }
    ],
    "takeaway": "When multiplying a polynomial and a transcendental function, choose the polynomial as $u$ to reduce its degree via differentiation.",
    "commonMistakes": [
      "Forgetting the negative sign during integration of sin(x)",
      "Sign errors in the integration by parts formula"
    ],
    "conceptChips": [
      "Integration by parts",
      "Tabular method"
    ],
    "importantObservation": "The integral of sin(x) is -cos(x), not cos(x).",
    "notations": [
      {
        "symbol": "u",
        "meaning": "The part to be differentiated"
      },
      {
        "symbol": "dv",
        "meaning": "The part to be integrated"
      }
    ]
  },
  "finalAnswer": {
    "value": "-x*cos(x) + sin(x) + C",
    "option": "A"
  },
  "availableModes": [
    "examMode",
    "learnMode"
  ],
  "subject": "Mathematics",
  "topic": "Calculus",
  "subtopic": "Integration",
  "difficulty": "Easy",
  "questionType": "Calculation",
  "primaryConcept": "Integration by parts",
  "schemaVersion": 3,
  "promptVersion": "solution-v3",
  "generatedAt": "2026-06-30T21:40:17.293Z",
  "generatorModel": "gemini-3.1-flash-lite",
  "validationStatus": "pending"
}
```

---

