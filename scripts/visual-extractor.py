import sys
import json
import base64
import io
import fitz  # PyMuPDF
from PIL import Image
import re
import google.generativeai as genai
import typing
import concurrent.futures

class OptionBox(typing.TypedDict):
    id: str
    box: list[int]

class QuestionBox(typing.TypedDict):
    id: str
    type: str
    subject: str
    answer: typing.Optional[str]
    stem_box: list[int]
    options: list[OptionBox]

class ExtractResult(typing.TypedDict):
    question: QuestionBox

def get_base64_crop(img: Image.Image, box) -> str:
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
    buf = io.BytesIO()
    cropped.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

def process_chunk(chunk_img: Image.Image, model, expected_id: str):
    img_byte_arr = io.BytesIO()
    chunk_img.save(img_byte_arr, format='PNG')
    img_bytes = img_byte_arr.getvalue()
    
    prompt = f"""You are a visual layout extractor. This image contains ONE specific question (Question {expected_id}).
Extract the exact bounding boxes for the question stem and its options.
Return a JSON object with:
- id: "{expected_id}"
- type: "mcq" or "numerical"
- subject: inferred subject (Physics, Chemistry, Mathematics)
- answer: correct option ID if indicated, else null
- stem_box: bounding box of the question text and diagrams [ymin, xmin, ymax, xmax] scaled to 1000.
- options: list of options with id (A, B, C, D or 1, 2, 3, 4) and bounding box [ymin, xmin, ymax, xmax] scaled to 1000. Ensure you capture ALL options.
"""
    try:
        response = model.generate_content([
            prompt,
            {"mime_type": "image/png", "data": img_bytes}
        ], generation_config={
            "response_mime_type": "application/json",
            "response_schema": ExtractResult
        })
        
        data = json.loads(response.text)
        q = data.get("question")
        if not q: return None
        
        # Override ID to match our heuristic
        q["id"] = expected_id
        
        if "stem_box" in q and len(q["stem_box"]) == 4:
            q["stem_image"] = get_base64_crop(chunk_img, q["stem_box"])
        
        for opt in q.get("options", []):
            if "box" in opt and len(opt["box"]) == 4:
                opt["image"] = get_base64_crop(chunk_img, opt["box"])
                
        return q
    except Exception as e:
        print(f"Error processing chunk Q{expected_id}: {str(e)}", file=sys.stderr)
        return None

def main():
    pdf_path = sys.argv[1]
    api_key = sys.argv[2]
    
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    
    doc = fitz.open(pdf_path)
    
    # 1. OCR locally to find chunks
    q_pattern = re.compile(r'^(?:Q\.?|Question|Q)?\s*(\d+)\.')
    
    all_chunks = [] # list of (img, q_id)
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=300)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        blocks = page.get_text("dict")["blocks"]
        lines = []
        for b in blocks:
            if "lines" in b:
                for l in b["lines"]:
                    text = "".join([s["text"] for s in l["spans"]]).strip()
                    if text:
                        lines.append({"text": text, "y0": l["bbox"][1], "y1": l["bbox"][3]})
                        
        lines.sort(key=lambda x: x["y0"])
        
        questions = []
        for l in lines:
            match = q_pattern.match(l["text"])
            if match:
                questions.append({"id": match.group(1), "y": l["y0"]})
                
        if not questions:
            # Maybe the whole page is one question or a continuation, skip for chunking or treat as 1
            continue
            
        page_height = page.rect.height
        
        for i in range(len(questions)):
            q = questions[i]
            y0 = max(0, q["y"] - 20)
            if i < len(questions) - 1:
                y1 = questions[i+1]["y"] - 10
            else:
                y1 = page_height
                
            # Scale coordinates to image DPI
            scale_y = img.height / page_height
            crop_y0 = int(y0 * scale_y)
            crop_y1 = int(y1 * scale_y)
            
            chunk_img = img.crop((0, crop_y0, img.width, crop_y1))
            all_chunks.append((chunk_img, q["id"]))
            
    # 2. Gemini parses each chunk in parallel
    all_questions = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_chunk = {executor.submit(process_chunk, chunk_img, model, q_id): q_id for chunk_img, q_id in all_chunks}
        for future in concurrent.futures.as_completed(future_to_chunk):
            res = future.result()
            if res:
                all_questions.append(res)
                
    # Sort questions by ID to maintain order
    all_questions.sort(key=lambda x: int(x["id"]) if x["id"].isdigit() else 0)
    
    print(json.dumps({"questions": all_questions}))

if __name__ == "__main__":
    main()
