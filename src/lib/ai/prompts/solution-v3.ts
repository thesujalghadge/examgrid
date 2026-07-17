/**
 * Solution Prompt V3.2 — Objective-Based, Dual-Mode, Anti-AI (Information Value Focus)
 *
 * Design principles:
 * - Optimize for OBJECTIVES, not personas
 * - Exam Strategy: shortest correct path under time pressure
 * - Concept Breakdown: reduce cognitive load, connect the missing idea
 * - Every sentence must earn its place
 * - No AI filler, no textbook narration
 * - Schema-driven output: renderer decides layout
 */
export const SOLUTION_PROMPT_V3 = `
The goal is NOT to generate a complete solution.
The goal is to generate the minimum explanation that maximizes understanding.
Assume every additional sentence has a cost.
Only include information whose learning value is greater than its reading cost.

Before writing each sentence ask:
"Does this sentence teach something the previous sentence did not?"
If not, remove it.

You must generate TWO fundamentally different solutions for the same question.
These are NOT short vs long versions. They are different products with different objectives.

# ⚡ EXAM STRATEGY

## Objective
Generate the shortest correct solution that maximizes marks under real JEE/NEET exam conditions.

## Assumptions
- The student already knows the entire syllabus.
- Time is the limiting factor, not theory.
- Every extra sentence increases cognitive load and wastes exam time.

## Optimization priorities (highest to lowest)
1. Fastest valid solving path.
2. Pattern recognition over derivation.
3. Equations over prose.
4. Eliminate unnecessary mental steps.
5. Never explain what the student already knows.

## Rules
- A student should be able to copy Exam Strategy directly onto rough paper during an exam.
- If it looks like notes or an explanation instead of rough work, rewrite it.
- No narration. No complete sentences. Minimal English.
- Maximum steps: Easy=4, Medium=5, Hard=7. Each step: 1–2 lines MAX.
- Prefer equations and symbols. Avoid sentences.
- Skip obvious algebra. Show only non-trivial jumps.
- Never test every option individually (use algebra/elimination instead).
- Never re-derive standard results.
- For \`examTricks\`: Must be highly actionable mathematical or logical observations (e.g., 'Treat NOR(A,A) as NOT'). Do not use generic tricks like 'Check options'. Omit if none apply.

## ❌ BAD Exam Strategy (DO NOT generate this)
\`\`\`
The circuit consists of two branches.
The upper branch has a NOR gate that performs the operation...
The lower branch takes inputs C and D and applies...
The LED glows when the output is HIGH, which means...
Therefore, checking each option systematically...
\`\`\`

## ✅ GOOD Exam Strategy (generate THIS style)
\`\`\`
Upper: A+B
Lower: (C+D)'
Need: (A+B)=1, (C+D)'=0
Only D.
\`\`\`

---

# 📘 CONCEPT BREAKDOWN

## Objective
Reduce cognitive load. Make the solution feel easier than the question.

## Success metric
Success is NOT measured by completeness.
Success is measured by how quickly the student connects the missing idea.

## Assumptions
- The student knows the chapter.
- The student got THIS question wrong or couldn't solve it.
- They don't need a chapter recap.

## Rules
- Every question has one hidden observation that makes it easy. Find that observation first.
- Build the entire solution around it. Never distribute attention equally across all steps.
- The \`keyIdea\` must state the actual single observation that unlocks the problem, NOT a generic statement of fact.
- Every sentence must either: reveal the hidden observation, eliminate a mistake, or advance the solution. Otherwise remove it.
- Never reteach the chapter or NCERT theory.
- Prefer intuition before equations.
- A student should finish reading and think: "Oh... that's actually simple."

## ❌ BAD Concept Breakdown (DO NOT generate this)
\`\`\`
The path difference changes because the recorder moves along the line
perpendicular to the sources. As the recorder moves, the distance from
each source changes differently, leading to constructive and destructive
interference patterns. When the path difference equals an integer
multiple of the wavelength, constructive interference occurs...
\`\`\`

## ✅ GOOD Concept Breakdown (generate THIS style)
\`\`\`
The only idea here:
Every complete loud-soft-loud cycle = one wavelength of path difference change.
Count total cycles → total path difference change.
Divide by number of cycles to get λ.
Then v = fλ.
That's it.
\`\`\`

---

# UI vs Analytics Fields (IMPORTANT)
Generate \`examTricks\`, \`conceptChips\`, \`assumptions\`, \`commonMistakes\`, and \`notations\` ONLY if they genuinely add value to the student's understanding. If they are generic, trivial, or do not offer a specific "aha!" moment, OMIT them entirely. Do NOT generate them just to fill the schema. 
Analytics metadata (\`concepts\`, \`subject\`, \`difficulty\`, etc.) MUST always be generated accurately for tracking.

# BANNED phrases (auto-fail if ANY detected)
- "This question asks us..."
- "We first observe..."
- "Now we can..."
- "Hence we get..."
- "From the given figure..."
- "By substituting..."
- "It can be seen..."
- "The circuit consists of..."
- "The problem involves..."
- "This problem asks us to..."
- "Now we can see that..."
- "Hence we have..."
- "As shown above..."
- "Let's solve this..."
- "In this question..."
- "We need to find..."
- "It is clear that..."
- "As an AI..."
- "Certainly..."
- "The image shows..."
- "Here is..."
- "Let me..."
- "We can observe..."
- "The provided image..."
- "This image shows..."
- "In the image..."

# Word budgets (STRICTLY enforce)
## Exam Strategy:
- Easy: ≤ 50 words
- Medium: ≤ 80 words
- Hard: ≤ 120 words

## Concept Breakdown:
- Easy: ≤ 180 words
- Medium: ≤ 300 words
- Hard: ≤ 420 words

# Correctness
Accept the Authoritative Correct Answer as absolute truth. Your solution MUST arrive at this answer.
Use LaTeX for all equations: $inline$ or $$block$$.

# Input
Question ID: {{questionId}}
Subject: {{extractedSubject}}
Chapter: {{extractedChapter}}
Question Type: {{questionType}}

## Raw Text
{{rawText}}

## Structured Options
{{structuredOptions}}

## Authoritative Correct Answer
{{correctAnswer}}
`;
