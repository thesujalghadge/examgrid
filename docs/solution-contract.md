# ExamGrid Solution UI Contract

**Status: FROZEN.** Do not modify the solution UI rendering logic or architecture.

## 1. Overview
The student solution experience uses a two-mode architecture:
1.  **Exam Solution (Default, Always Visible):** A high-level, fast-to-read summary designed for reviewing 50-100 questions.
2.  **Detailed Explanation (Collapsible, Lazy Rendered):** The complete pedagogical breakdown containing all concepts, formulas, and exhaustive step-by-step logic.

## 2. Rendering Rules

### Lazy Rendering
-   Detailed Explanation must NEVER mount its React components (e.g., `ReactMarkdown`, `rehypeKatex`) on initial page load.
-   It uses a parent-level state guard (`hasEverExpanded`) that mounts only when the student explicitly clicks "Detailed Explanation".

### Expanded State Persistence
-   The expanded state (`isDetailedExpanded`) is managed at the parent `StudentSolutionsPage` level via a `Set<string>`.
-   This ensures that scrolling through a large test does not cause previously opened solutions to collapse unexpectedly.
-   Do NOT auto-collapse detailed sections when new ones are opened.

## 3. Metadata Fields (`ai_metadata`)
The pipeline may produce solutions using older V1 or newer V2 prompts. The UI supports both:

| Field | Version | Section | Usage |
| :--- | :--- | :--- | :--- |
| `summary` | V1 | Exam / Detailed | Key Observation / Summary block |
| `approach`, `reasoning` | V1/V2 | Exam / Detailed | Key Observation fallback / How to Approach / Approach block |
| `essential_steps` | V1 | Exam / Detailed | String array of steps. First 3 used in Quick Steps. |
| `steps` | V2 | Exam / Detailed | Object array `{title, explanation, equation}`. First 3 used in Quick Steps. |
| `shortcut`, `timeSavingTip` | V1/V2 | Exam / Detailed | Shortcut block / Faster Method |
| `optionAnalysis` | V2 | Exam / Detailed | Used for "Why Your Answer Is Wrong" and full Option Analysis block. |
| `examFrequency` | V1/V2 | Exam | "Why This Question Matters" insight text. |
| `concepts`, `concept` | V1/V2 | Detailed | Concepts block |
| `formulas` | V1/V2 | Detailed | Formulae block |
| `commonMistake` | V1/V2 | Detailed | Common Mistake block |
| `takeaway` | V1/V2 | Detailed | Key Takeaway block |

## 4. Personalization Rules
The **Exam Solution** tab contains a dynamic, personalized review block based on the student's attempt status for that specific question:

| Status | Block Header | Content Source | Fallback if source missing |
| :--- | :--- | :--- | :--- |
| **Attempted + Incorrect** | ❌ Why Your Answer Is Wrong | `optionAnalysis.find(oa => oa.option === selected).whyWrong` | Shows `correctAnswer` + `reasoning` / `approach` |
| **Attempted + Correct** | ✅ Faster Method | `shortcut` OR `timeSavingTip` | "You chose the optimal approach! Well done." |
| **Unattempted** | 🎯 How To Approach This | `approach` OR `quick_approach` OR `reasoning` | Shows `correctAnswer` |

## 5. Exam Solution Block Rules
-   **Quick Steps:** Strictly capped at a maximum of **3 steps**.
-   **Why This Question Matters:** Only rendered if `examFrequency` string data is present (provides text insights, not badges).
-   **No Tabs:** The interface uses an accordion (expand/collapse) for the Detailed section to minimize clicks.

## 6. Detailed Explanation Block Rules
When expanded, the Detailed Explanation strictly follows this top-to-bottom rendering order to align with student cognitive flow:
1.  Concepts
2.  Formulae
3.  Step-by-Step Solution
4.  Final Answer
5.  Common Mistake
6.  Option Analysis
7.  Key Takeaway
8.  Approach & Reasoning
9.  Summary

**DO NOT MODIFY THIS CONTRACT OR THE ASSOCIATED COMPONENT LOGIC.**
