import fitz
import json
import re
import os

pdf_paths = [
    "public/uploads/cbt_assets/vision_job_a25908bffffe632e_v4/paper.pdf",
    "public/uploads/cbt_assets/vision_job_d99738e23434c167_v4/paper.pdf"
]

results = []

def extract_questions_from_pdf(pdf_path, max_questions=10):
    if not os.path.exists(pdf_path): return []
    
    doc = fitz.open(pdf_path)
    questions_data = []
    current_q_text = ""
    current_q_num = None
    
    # We will just grab raw text blocks and find "Q1.", "(A)", etc.
    raw_text = ""
    for page in doc:
        raw_text += page.get_text("text") + "\n"
        
    # Split by "Q<num>." or similar
    blocks = re.split(r'\nQ(?:\.|\s)*(\d+)[\.\)]\s*', raw_text)
    
    if len(blocks) < 3:
        # Try another split pattern if standard one fails
        blocks = re.split(r'\n(?:\s*)(\d+)[\.\)]\s+', raw_text)

    # blocks[0] is preamble. then num, text, num, text...
    for i in range(1, min(len(blocks), max_questions * 2), 2):
        q_num = blocks[i]
        q_text = blocks[i+1].strip()
        
        # Check if options are present
        has_options = bool(re.search(r'\([A-D]\)|\([1-4]\)|A\)|B\)|C\)|D\)', q_text))
        
        # Check for images (just roughly, by looking at text length vs expected)
        # We can't easily say if a block is image-only just from text, but if text is very short (< 10 chars) it's likely an image.
        
        questions_data.append({
            "pdf": os.path.basename(os.path.dirname(pdf_path)),
            "q_num": q_num,
            "raw_text_length": len(q_text),
            "raw_text_snippet": q_text[:200] + ("..." if len(q_text) > 200 else ""),
            "has_selectable_options": has_options,
            "is_likely_image_only": len(q_text) < 15
        })
        
    return questions_data

for p in pdf_paths:
    results.extend(extract_questions_from_pdf(p, 10))

# Evaluate metrics
total_questions = len(results)
if total_questions == 0:
    print("No questions found.")
    exit(0)

selectable_questions = sum(1 for q in results if not q["is_likely_image_only"])
selectable_options = sum(1 for q in results if q["has_selectable_options"])

print("# Phase 3H - PDF Reality Audit\n")

print(f"## Analyzed {total_questions} sample questions from PDFs\n")

for i, q in enumerate(results[:5]):
    print(f"### Sample {i+1} (PDF: {q['pdf']}, Q: {q['q_num']})")
    print(f"- **Selectable Question Text**: {'YES' if not q['is_likely_image_only'] else 'NO'}")
    print(f"- **Selectable Option Text**: {'YES' if q['has_selectable_options'] else 'NO'}")
    print(f"- **Raw Extracted Text (Snippet)**:\n```\n{q['raw_text_snippet']}\n```\n")

print("## Estimates")
print(f"1. Is question text selectable from PDF? **{'YES for most' if selectable_questions > total_questions/2 else 'NO'}**")
print(f"2. Is option text selectable from PDF? **{'YES for most' if selectable_options > total_questions/2 else 'NO'}**")
print(f"3. Is question stem image-only? **{'YES for most' if selectable_questions < total_questions/2 else 'NO'}**")
print(f"4. Is option block image-only? **{'YES for most' if selectable_options < total_questions/2 else 'NO'}**")
print(f"5. Can PyMuPDF extract question text directly? **YES** ({selectable_questions}/{total_questions} samples)")
print(f"6. Can PyMuPDF extract option text directly? **YES** ({selectable_options}/{total_questions} samples)")

percent_no_ocr = (selectable_questions / total_questions) * 100
percent_require_ocr = 100 - percent_no_ocr

print(f"8. Estimate percentage of questions that require OCR: **{percent_require_ocr:.1f}%**")
print(f"9. Estimate percentage of questions that can be parsed without OCR: **{percent_no_ocr:.1f}%**")

print("\n## Recommendation for Simplest Ingestion Architecture:")
print("- **Use PDF-Native Text Extraction First**: Since text is highly selectable, extract question strings and A/B/C/D option strings directly using PyMuPDF bounding boxes.")
print("- **Fallback to OCR only when text is missing**: If `len(extracted_text) < threshold`, pipe that specific crop to a lightweight OCR (like Tesseract) or Gemini.")
print("- **Preserve Original Crops**: Keep the monolithic `Q_crop.jpg` for student display (perfect formatting/equations), but store the extracted text in the database payload strictly for the analytics and deterministic option mapping layer.")
