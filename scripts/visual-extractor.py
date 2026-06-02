import sys
import json
import io
import os
import fitz  # PyMuPDF
from PIL import Image
from google import genai
from google.genai import types
import time

def get_saved_crop_url(img: Image.Image, box, filename: str, asset_dir: str, asset_url_prefix: str) -> str:
    if len(box) != 4: return ""
    y1, x1, y2, x2 = box
    ymin, ymax = sorted([y1, y2])
    xmin, xmax = sorted([x1, x2])
    
    width, height = img.size
    left = (xmin / 1000.0) * width
    upper = (ymin / 1000.0) * height
    right = (xmax / 1000.0) * width
    lower = (ymax / 1000.0) * height
    
    pad = 5
    left = max(0, left - pad)
    upper = max(0, upper - pad)
    right = min(width, right + pad)
    lower = min(height, lower + pad)
    
    cropped = img.crop((left, upper, right, lower))
    filepath = os.path.join(asset_dir, filename)
    cropped.save(filepath, format="PNG")
    return f"{asset_url_prefix}/{filename}"

def process_batch(batch_pages, prev_img, next_img, client, asset_dir, asset_url_prefix):
    parts = []
    
    prompt = f"You are a highly precise visual extractor for NTA JEE exam papers.\n"
    prompt += f"You are given a batch of {len(batch_pages)} sequential pages.\n"
    
    if prev_img:
        parts.append(prev_img)
        prompt += f"Image 1 is the Previous Page (for context only, do not extract from it).\n"
    
    start_idx = 2 if prev_img else 1
    for i, (p_num, img) in enumerate(batch_pages):
        parts.append(img)
        prompt += f"Image {start_idx + i} is Page {p_num} (Extract questions from this).\n"
        
    if next_img:
        parts.append(next_img)
        prompt += f"The last Image is the Next Page (for context only).\n"
        
    prompt += "\nExtract ALL questions that appear on the target pages.\n"
    prompt += "If a question starts on one page and finishes on another, extract it as ONE question and mark 'continued' as true.\n"
    prompt += "Return a JSON object with a 'questions' array. Ensure bounding boxes perfectly encapsulate the text, diagrams, and equations without cutting them off.\n"
    
    prompt += "Each question object MUST have:\n"
    prompt += "- id: the question number (e.g., '1', '25')\n"
    prompt += "- type: 'mcq' or 'numerical'\n"
    prompt += "- subject: 'Physics', 'Chemistry', 'Mathematics', or 'Unknown'\n"
    prompt += "- stem: full readable text of the question (use strict LaTeX for math and equations)\n"
    prompt += "- answer: correct option ID if indicated (e.g. 'A', '1'), else null\n"
    prompt += "- stem_box: bounding box of the question text/diagrams [ymin, xmin, ymax, xmax] scaled to 1000 RELATIVE TO THE SPECIFIC PAGE it was found on.\n"
    prompt += "- options: list of options with id (A, B, C, D or 1, 2, 3, 4), text (readable text with LaTeX), and box [ymin, xmin, ymax, xmax] scaled to 1000 RELATIVE TO THE SPECIFIC PAGE it was found on.\n"
    prompt += "- sourcePage: the page number where the majority of the question is located.\n"
    prompt += "- continued: true if the question spans across multiple pages, false otherwise.\n"
    prompt += "- confidence: number from 0 to 1 indicating extraction confidence.\n\n"
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt] + parts,
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        
        data = json.loads(response.text)
        questions = data.get("questions", [])
        
        results = []
        for i, q in enumerate(questions):
            source_page = q.get("sourcePage")
            # Find the corresponding image for this sourcePage
            page_img = None
            for p_num, img in batch_pages:
                if p_num == source_page:
                    page_img = img
                    break
            
            # Fallback to the first page in the batch if sourcePage is wrong
            if not page_img:
                source_page = batch_pages[0][0]
                page_img = batch_pages[0][1]
                q["sourcePage"] = source_page
                
            q_id_str = str(q.get("id", f"p{source_page}_{i}"))
            
            if "stem_box" in q and len(q["stem_box"]) == 4:
                filename = f"q_{q_id_str}_stem.png"
                q["stem_image"] = get_saved_crop_url(page_img, q["stem_box"], filename, asset_dir, asset_url_prefix)
            
            for opt_idx, opt in enumerate(q.get("options", [])):
                if "box" in opt and len(opt["box"]) == 4:
                    opt_id = str(opt.get("id", opt_idx))
                    filename = f"q_{q_id_str}_opt_{opt_id}.png"
                    opt["image"] = get_saved_crop_url(page_img, opt["box"], filename, asset_dir, asset_url_prefix)
                    
            results.append(q)
            
        return results
    except Exception as e:
        print(f"Error processing batch: {str(e)}", file=sys.stderr)
        # Raise exception to handle quota limit gracefully upstream
        if "429" in str(e) or "quota" in str(e).lower():
            raise e
        return []

def main():
    pdf_path = sys.argv[1]
    api_key = sys.argv[2]
    asset_dir = sys.argv[3]
    asset_url_prefix = sys.argv[4]
    
    client = genai.Client(api_key=api_key)
    
    doc = fitz.open(pdf_path)
    
    # Pre-filter pages
    valid_pages = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text").lower().strip()
        
        # Heuristic to skip completely blank pages or pure cover pages with no questions
        if len(text) < 20 and not page.get_images():
            continue
            
        # Skip obvious answer keys that don't have question text
        if "answer key" in text[:200] and "q." not in text and "question" not in text:
            continue
            
        # Render page
        pix = page.get_pixmap(dpi=300)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        valid_pages.append((page_num + 1, img))
        
    all_questions = []
    
    # Batch into groups of 3
    BATCH_SIZE = 3
    batches = [valid_pages[i:i + BATCH_SIZE] for i in range(0, len(valid_pages), BATCH_SIZE)]
    
    try:
        for i, batch in enumerate(batches):
            # Find context images
            prev_img = None
            if i > 0:
                prev_img = batches[i-1][-1][1]
                
            next_img = None
            if i < len(batches) - 1:
                next_img = batches[i+1][0][1]
                
            res = process_batch(batch, prev_img, next_img, client, asset_dir, asset_url_prefix)
            if res:
                all_questions.extend(res)
                
            if i < len(batches) - 1:
                time.sleep(4)
                
    except Exception as e:
        print(f"Extraction stopped prematurely: {str(e)}", file=sys.stderr)
        # We catch the quota error here and STILL return the questions extracted so far!
            
    # De-duplicate questions that span across pages
    deduped = {}
    for q in all_questions:
        q_id = str(q.get("id"))
        if q_id not in deduped:
            deduped[q_id] = q
        else:
            existing = deduped[q_id]
            if len(q.get("options", [])) > len(existing.get("options", [])):
                deduped[q_id] = q
                
    final_questions = list(deduped.values())
    final_questions.sort(key=lambda x: int(x["id"]) if str(x["id"]).isdigit() else 0)
    
    # Return whatever we got, even if partial
    print(json.dumps({"questions": final_questions}))

if __name__ == "__main__":
    main()
