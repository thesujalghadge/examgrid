# Reality Audit – Question Input Verification

### Question 1

**1. question_id:** cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-8

**2. published_question_text:**
```text

```

**3. published_image_url:** null

**4. image file exists?** NO

**5. image bytes loaded?** NO

**6. exact prompt text sent to Gemini:**
```text
Question:
Solve the following problem

Options:
A: 
B: 
C: 
D: 
__metadata__: {"stemImage":"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q8_crop.jpg","hasImage":true,"images":[]}

You are an expert exam question parser and solver.
Analyze the provided question. 
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning.
4. Output the final correct answer option (e.g., "A", "B", "C", "D" or the exact numerical value) in 'model_answer'.
5. Provide a confidence score (0-100) for your understanding and solution.

DO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.

Respond strictly in valid JSON format matching this structure:
{
  "subject": "string",
  "chapter": "string",
  "subchapter": "string",
  "concepts": ["string"],
  "summary": "string",
  "confidence": number,
  "reasoning": "string",
  "model_answer": "string"
}
```

**7. exact image count sent to Gemini:** 0

**8. exact request payload sent to Gemini:**
```json
[
  "Question:\nSolve the following problem\n\nOptions:\nA: \nB: \nC: \nD: \n__metadata__: {\"stemImage\":\"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q8_crop.jpg\",\"hasImage\":true,\"images\":[]}\n\nYou are an expert exam question parser and solver.\nAnalyze the provided question. \n1. Identify the subject, chapter, subchapter, and key concepts.\n2. Provide a short summary of the question.\n3. Solve the question completely independently. Provide your step-by-step reasoning.\n4. Output the final correct answer option (e.g., \"A\", \"B\", \"C\", \"D\" or the exact numerical value) in 'model_answer'.\n5. Provide a confidence score (0-100) for your understanding and solution.\n\nDO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.\n\nRespond strictly in valid JSON format matching this structure:\n{\n  \"subject\": \"string\",\n  \"chapter\": \"string\",\n  \"subchapter\": \"string\",\n  \"concepts\": [\"string\"],\n  \"summary\": \"string\",\n  \"confidence\": number,\n  \"reasoning\": \"string\",\n  \"model_answer\": \"string\"\n}"
]
```

**9. exact raw Gemini response:**
```json
API FAILED
```

**10. teacher answer:** B

**11. model answer:** 75

#### Diagnosed Issue:
- A) Missing text: YES
- B) Missing image: YES
- C) Wrong image: NO
- D) Prompt corruption: NO
- E) Model reasoning failure: NO

**CONCLUSION:** ROOT CAUSE FOUND. Gemini receives no image because published_image_url is null or empty. The image path is hidden inside published_question_text under __metadata__.

---

### Question 2

**1. question_id:** cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-11

**2. published_question_text:**
```text

```

**3. published_image_url:** null

**4. image file exists?** NO

**5. image bytes loaded?** NO

**6. exact prompt text sent to Gemini:**
```text
Question:
Solve the following problem

Options:
A: 
B: 
C: 
D: 
__metadata__: {"stemImage":"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q11_crop.jpg","hasImage":true,"images":[]}

You are an expert exam question parser and solver.
Analyze the provided question. 
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning.
4. Output the final correct answer option (e.g., "A", "B", "C", "D" or the exact numerical value) in 'model_answer'.
5. Provide a confidence score (0-100) for your understanding and solution.

DO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.

Respond strictly in valid JSON format matching this structure:
{
  "subject": "string",
  "chapter": "string",
  "subchapter": "string",
  "concepts": ["string"],
  "summary": "string",
  "confidence": number,
  "reasoning": "string",
  "model_answer": "string"
}
```

**7. exact image count sent to Gemini:** 0

**8. exact request payload sent to Gemini:**
```json
[
  "Question:\nSolve the following problem\n\nOptions:\nA: \nB: \nC: \nD: \n__metadata__: {\"stemImage\":\"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q11_crop.jpg\",\"hasImage\":true,\"images\":[]}\n\nYou are an expert exam question parser and solver.\nAnalyze the provided question. \n1. Identify the subject, chapter, subchapter, and key concepts.\n2. Provide a short summary of the question.\n3. Solve the question completely independently. Provide your step-by-step reasoning.\n4. Output the final correct answer option (e.g., \"A\", \"B\", \"C\", \"D\" or the exact numerical value) in 'model_answer'.\n5. Provide a confidence score (0-100) for your understanding and solution.\n\nDO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.\n\nRespond strictly in valid JSON format matching this structure:\n{\n  \"subject\": \"string\",\n  \"chapter\": \"string\",\n  \"subchapter\": \"string\",\n  \"concepts\": [\"string\"],\n  \"summary\": \"string\",\n  \"confidence\": number,\n  \"reasoning\": \"string\",\n  \"model_answer\": \"string\"\n}"
]
```

**9. exact raw Gemini response:**
```json
API FAILED
```

**10. teacher answer:** D

**11. model answer:** 12

#### Diagnosed Issue:
- A) Missing text: YES
- B) Missing image: YES
- C) Wrong image: NO
- D) Prompt corruption: NO
- E) Model reasoning failure: NO

**CONCLUSION:** ROOT CAUSE FOUND. Gemini receives no image because published_image_url is null or empty. The image path is hidden inside published_question_text under __metadata__.

---

### Question 3

**1. question_id:** cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-4

**2. published_question_text:**
```text

```

**3. published_image_url:** null

**4. image file exists?** NO

**5. image bytes loaded?** NO

**6. exact prompt text sent to Gemini:**
```text
Question:
Solve the following problem

Options:
A: 
B: 
C: 
D: 
__metadata__: {"stemImage":"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q4_crop.jpg","hasImage":true,"images":[]}

You are an expert exam question parser and solver.
Analyze the provided question. 
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning.
4. Output the final correct answer option (e.g., "A", "B", "C", "D" or the exact numerical value) in 'model_answer'.
5. Provide a confidence score (0-100) for your understanding and solution.

DO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.

Respond strictly in valid JSON format matching this structure:
{
  "subject": "string",
  "chapter": "string",
  "subchapter": "string",
  "concepts": ["string"],
  "summary": "string",
  "confidence": number,
  "reasoning": "string",
  "model_answer": "string"
}
```

**7. exact image count sent to Gemini:** 0

**8. exact request payload sent to Gemini:**
```json
[
  "Question:\nSolve the following problem\n\nOptions:\nA: \nB: \nC: \nD: \n__metadata__: {\"stemImage\":\"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q4_crop.jpg\",\"hasImage\":true,\"images\":[]}\n\nYou are an expert exam question parser and solver.\nAnalyze the provided question. \n1. Identify the subject, chapter, subchapter, and key concepts.\n2. Provide a short summary of the question.\n3. Solve the question completely independently. Provide your step-by-step reasoning.\n4. Output the final correct answer option (e.g., \"A\", \"B\", \"C\", \"D\" or the exact numerical value) in 'model_answer'.\n5. Provide a confidence score (0-100) for your understanding and solution.\n\nDO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.\n\nRespond strictly in valid JSON format matching this structure:\n{\n  \"subject\": \"string\",\n  \"chapter\": \"string\",\n  \"subchapter\": \"string\",\n  \"concepts\": [\"string\"],\n  \"summary\": \"string\",\n  \"confidence\": number,\n  \"reasoning\": \"string\",\n  \"model_answer\": \"string\"\n}"
]
```

**9. exact raw Gemini response:**
```json
API FAILED
```

**10. teacher answer:** A

**11. model answer:** 5

#### Diagnosed Issue:
- A) Missing text: YES
- B) Missing image: YES
- C) Wrong image: NO
- D) Prompt corruption: NO
- E) Model reasoning failure: NO

**CONCLUSION:** ROOT CAUSE FOUND. Gemini receives no image because published_image_url is null or empty. The image path is hidden inside published_question_text under __metadata__.

---

### Question 4

**1. question_id:** cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-7

**2. published_question_text:**
```text

```

**3. published_image_url:** null

**4. image file exists?** NO

**5. image bytes loaded?** NO

**6. exact prompt text sent to Gemini:**
```text
Question:
Solve the following problem

Options:
A: 
B: 
C: 
D: 
__metadata__: {"stemImage":"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q7_crop.jpg","hasImage":true,"images":[]}

You are an expert exam question parser and solver.
Analyze the provided question. 
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning.
4. Output the final correct answer option (e.g., "A", "B", "C", "D" or the exact numerical value) in 'model_answer'.
5. Provide a confidence score (0-100) for your understanding and solution.

DO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.

Respond strictly in valid JSON format matching this structure:
{
  "subject": "string",
  "chapter": "string",
  "subchapter": "string",
  "concepts": ["string"],
  "summary": "string",
  "confidence": number,
  "reasoning": "string",
  "model_answer": "string"
}
```

**7. exact image count sent to Gemini:** 0

**8. exact request payload sent to Gemini:**
```json
[
  "Question:\nSolve the following problem\n\nOptions:\nA: \nB: \nC: \nD: \n__metadata__: {\"stemImage\":\"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q7_crop.jpg\",\"hasImage\":true,\"images\":[]}\n\nYou are an expert exam question parser and solver.\nAnalyze the provided question. \n1. Identify the subject, chapter, subchapter, and key concepts.\n2. Provide a short summary of the question.\n3. Solve the question completely independently. Provide your step-by-step reasoning.\n4. Output the final correct answer option (e.g., \"A\", \"B\", \"C\", \"D\" or the exact numerical value) in 'model_answer'.\n5. Provide a confidence score (0-100) for your understanding and solution.\n\nDO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.\n\nRespond strictly in valid JSON format matching this structure:\n{\n  \"subject\": \"string\",\n  \"chapter\": \"string\",\n  \"subchapter\": \"string\",\n  \"concepts\": [\"string\"],\n  \"summary\": \"string\",\n  \"confidence\": number,\n  \"reasoning\": \"string\",\n  \"model_answer\": \"string\"\n}"
]
```

**9. exact raw Gemini response:**
```json
API FAILED
```

**10. teacher answer:** A

**11. model answer:** 55

#### Diagnosed Issue:
- A) Missing text: YES
- B) Missing image: YES
- C) Wrong image: NO
- D) Prompt corruption: NO
- E) Model reasoning failure: NO

**CONCLUSION:** ROOT CAUSE FOUND. Gemini receives no image because published_image_url is null or empty. The image path is hidden inside published_question_text under __metadata__.

---

### Question 5

**1. question_id:** cbt-52421be1-605a-4604-ae50-2d919f4e06d4-paper-1781874180816-question-14

**2. published_question_text:**
```text

```

**3. published_image_url:** null

**4. image file exists?** NO

**5. image bytes loaded?** NO

**6. exact prompt text sent to Gemini:**
```text
Question:
Solve the following problem

Options:
A: 
B: 
C: 
D: 
__metadata__: {"stemImage":"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q14_crop.jpg","hasImage":true,"images":[]}

You are an expert exam question parser and solver.
Analyze the provided question. 
1. Identify the subject, chapter, subchapter, and key concepts.
2. Provide a short summary of the question.
3. Solve the question completely independently. Provide your step-by-step reasoning.
4. Output the final correct answer option (e.g., "A", "B", "C", "D" or the exact numerical value) in 'model_answer'.
5. Provide a confidence score (0-100) for your understanding and solution.

DO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.

Respond strictly in valid JSON format matching this structure:
{
  "subject": "string",
  "chapter": "string",
  "subchapter": "string",
  "concepts": ["string"],
  "summary": "string",
  "confidence": number,
  "reasoning": "string",
  "model_answer": "string"
}
```

**7. exact image count sent to Gemini:** 0

**8. exact request payload sent to Gemini:**
```json
[
  "Question:\nSolve the following problem\n\nOptions:\nA: \nB: \nC: \nD: \n__metadata__: {\"stemImage\":\"/uploads/cbt_assets/vision_job_d99738e23434c167_v4/vision_crops/Q14_crop.jpg\",\"hasImage\":true,\"images\":[]}\n\nYou are an expert exam question parser and solver.\nAnalyze the provided question. \n1. Identify the subject, chapter, subchapter, and key concepts.\n2. Provide a short summary of the question.\n3. Solve the question completely independently. Provide your step-by-step reasoning.\n4. Output the final correct answer option (e.g., \"A\", \"B\", \"C\", \"D\" or the exact numerical value) in 'model_answer'.\n5. Provide a confidence score (0-100) for your understanding and solution.\n\nDO NOT hallucinate. Do not guess. If the question is incomplete, set confidence to 0.\n\nRespond strictly in valid JSON format matching this structure:\n{\n  \"subject\": \"string\",\n  \"chapter\": \"string\",\n  \"subchapter\": \"string\",\n  \"concepts\": [\"string\"],\n  \"summary\": \"string\",\n  \"confidence\": number,\n  \"reasoning\": \"string\",\n  \"model_answer\": \"string\"\n}"
]
```

**9. exact raw Gemini response:**
```json
API FAILED
```

**10. teacher answer:** A

**11. model answer:** 33

#### Diagnosed Issue:
- A) Missing text: YES
- B) Missing image: YES
- C) Wrong image: NO
- D) Prompt corruption: NO
- E) Model reasoning failure: NO

**CONCLUSION:** ROOT CAUSE FOUND. Gemini receives no image because published_image_url is null or empty. The image path is hidden inside published_question_text under __metadata__.

---

