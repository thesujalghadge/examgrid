import sys
import json
import io
import os
import fitz  # PyMuPDF
from PIL import Image
import google.generativeai as genai
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

def image_to_parts(img: Image.Image):
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return {"mime_type": "image/png", "data": buf.getvalue()}

def process_page(page_img, prev_img, next_img, page_num, model, asset_dir, asset_url_prefix):
    parts = []
    
    prompt = f"You are a highly precise visual extractor for NTA JEE exam papers.\n"
    prompt += f"This is Page {page_num} of the PDF.\n"
    
    if prev_img:
        parts.append(image_to_parts(prev_img))
        prompt += f"Image 1 is Page {page_num - 1} (Previous Page, for context only).\n"
    if next_img:
        parts.append(image_to_parts(next_img))
        prompt += f"Image {'2' if prev_img else '1'} is Page {page_num + 1} (Next Page, for context only).\n"
        
    parts.append(image_to_parts(page_img))
    prompt += f"The LAST image is Page {page_num} (The Current Page).\n\n"
    
    prompt += f"Extract ALL questions that appear on the Current Page (Page {page_num}).\n"
    prompt += "If a question starts on the previous page and finishes on this page, or starts on this page and finishes on the next page, STILL extract it but mark 'continued' as true.\n"
    prompt += "Return a JSON object with a 'questions' array. Ensure bounding boxes perfectly encapsulate the text, diagrams, and equations without cutting them off.\n"
    
    prompt += "Each question object MUST have:\n"
    prompt += "- id: the question number (e.g., '1', '25')\n"
    prompt += "- type: 'mcq' or 'numerical'\n"
    prompt += "- subject: 'Physics', 'Chemistry', 'Mathematics', or 'Unknown'\n"
    prompt += "- stem: full readable text of the question (use strict LaTeX for math and equations)\n"
    prompt += "- answer: correct option ID if indicated (e.g. 'A', '1'), else null\n"
    prompt += "- stem_box: bounding box of the question text/diagrams [ymin, xmin, ymax, xmax] scaled to 1000 RELATIVE TO THE CURRENT PAGE (Page {page_num}).\n"
    prompt += "- options: list of options with id (A, B, C, D or 1, 2, 3, 4), text (readable text with LaTeX), and box [ymin, xmin, ymax, xmax] scaled to 1000 RELATIVE TO THE CURRENT PAGE (Page {page_num}).\n"
    prompt += f"- sourcePage: {page_num}\n"
    prompt += "- continued: true if the question spans across multiple pages, false otherwise.\n"
    prompt += "- confidence: number from 0 to 1 indicating extraction confidence.\n\n"
    
    try:
        response = model.generate_content([prompt] + parts, generation_config={
            "response_mime_type": "application/json"
        })
        
        data = json.loads(response.text)
        questions = data.get("questions", [])
        
        results = []
        for i, q in enumerate(questions):
            q_id_str = str(q.get("id", f"p{page_num}_{i}"))
            
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
        print(f"Error processing Page {page_num}: {str(e)}", file=sys.stderr)
        return []

def main():
    pdf_path = sys.argv[1]
    api_key = sys.argv[2]
    asset_dir = sys.argv[3]
    asset_url_prefix = sys.argv[4]
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    doc = fitz.open(pdf_path)
    
    # Pre-render all pages to high-res images
    page_images = []
    for page_num in range(len(doc)):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=300)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        page_images.append(img)
        
    all_questions = []
    
    # Process one page at a time
    for i, img in enumerate(page_images):
        prev_img = page_images[i-1] if i > 0 else None
        next_img = page_images[i+1] if i < len(page_images) - 1 else None
        
        res = process_page(img, prev_img, next_img, i + 1, model, asset_dir, asset_url_prefix)
        if res:
            all_questions.extend(res)
            
        # Respect free-tier rate limit (15 RPM)
        if i < len(page_images) - 1:
            time.sleep(4)
            
    # De-duplicate questions that span across pages (they might be extracted on both)
    # We keep the one with the larger bounding box (usually the main part) or just the first one.
    deduped = {}
    for q in all_questions:
        q_id = str(q.get("id"))
        if q_id not in deduped:
            deduped[q_id] = q
        else:
            # If already exists, and the new one has more options, replace it.
            existing = deduped[q_id]
            if len(q.get("options", [])) > len(existing.get("options", [])):
                deduped[q_id] = q
                
    final_questions = list(deduped.values())
    final_questions.sort(key=lambda x: int(x["id"]) if str(x["id"]).isdigit() else 0)
    
    print(json.dumps({"questions": final_questions}))

if __name__ == "__main__":
    main()
