import sys
import json
import base64
import io
import fitz  # PyMuPDF
from PIL import Image
import re
import google.generativeai as genai
import typing
import time

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

class BatchExtractResult(typing.TypedDict):
    questions: list[QuestionBox]

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

def process_batch(chunk_batch: list[tuple[Image.Image, str]], model) -> list:
    parts = []
    expected_ids = []
    
    prompt = f"You are a visual layout extractor. You are given {len(chunk_batch)} images in order. Each image contains ONE specific question.\n"
    prompt += "Extract the exact bounding boxes for the question stem and its options for EACH image.\n"
    prompt += "Return a JSON object with a 'questions' array. The array must contain exactly one object per image, in the exact same order.\n"
    prompt += "Each question object MUST have:\n"
    prompt += "- id: the question number (provided below)\n"
    prompt += "- type: 'mcq' or 'numerical'\n"
    prompt += "- subject: inferred subject (Physics, Chemistry, Mathematics)\n"
    prompt += "- answer: correct option ID if indicated, else null\n"
    prompt += "- stem_box: bounding box of the question text and diagrams [ymin, xmin, ymax, xmax] scaled to 1000.\n"
    prompt += "- options: list of options with id (A, B, C, D or 1, 2, 3, 4) and bounding box [ymin, xmin, ymax, xmax] scaled to 1000. Ensure you capture ALL options.\n\n"
    
    for i, (img, q_id) in enumerate(chunk_batch):
        expected_ids.append(q_id)
        prompt += f"Image {i+1} corresponds to Question ID: {q_id}\n"
        
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        parts.append({"mime_type": "image/png", "data": img_byte_arr.getvalue()})
        
    try:
        response = model.generate_content([prompt] + parts, generation_config={
            "response_mime_type": "application/json"
        })
        
        data = json.loads(response.text)
        questions = data.get("questions", [])
        
        results = []
        for i, q in enumerate(questions):
            if i >= len(chunk_batch): break
            chunk_img, q_id = chunk_batch[i]
            q["id"] = q_id  # override to ensure correct ID mapping
            
            if "stem_box" in q and len(q["stem_box"]) == 4:
                q["stem_image"] = get_base64_crop(chunk_img, q["stem_box"])
            
            for opt in q.get("options", []):
                if "box" in opt and len(opt["box"]) == 4:
                    opt["image"] = get_base64_crop(chunk_img, opt["box"])
                    
            results.append(q)
            
        return results
    except Exception as e:
        print(f"Error processing batch of {len(chunk_batch)} questions: {str(e)}", file=sys.stderr)
        return []

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
            
    # 2. Gemini parses batches of chunks to respect rate limits
    BATCH_SIZE = 15
    batches = [all_chunks[i:i + BATCH_SIZE] for i in range(0, len(all_chunks), BATCH_SIZE)]
    
    all_questions = []
    
    for i, batch in enumerate(batches):
        res = process_batch(batch, model)
        if res:
            all_questions.extend(res)
        # Sleep for 4 seconds between batches to avoid free tier burst limits (15 RPM limit)
        if i < len(batches) - 1:
            time.sleep(4)
                
    # Sort questions by ID to maintain order
    all_questions.sort(key=lambda x: int(x["id"]) if x["id"].isdigit() else 0)
    
    print(json.dumps({"questions": all_questions}))

if __name__ == "__main__":
    main()
