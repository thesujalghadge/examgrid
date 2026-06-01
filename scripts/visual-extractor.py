import sys
import json
import base64
import io
import fitz  # PyMuPDF
from PIL import Image
import google.generativeai as genai
import typing_extensions as typing

pdf_path = sys.argv[1]
api_key = sys.argv[2]

genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-2.0-flash')

def get_base64_crop(img: Image.Image, box) -> str:
    # box is [ymin, xmin, ymax, xmax] normalized to 1000
    ymin, xmin, ymax, xmax = box
    width, height = img.size
    left = (xmin / 1000.0) * width
    upper = (ymin / 1000.0) * height
    right = (xmax / 1000.0) * width
    lower = (ymax / 1000.0) * height
    
    # Add a small padding
    pad = 5
    left = max(0, left - pad)
    upper = max(0, upper - pad)
    right = min(width, right + pad)
    lower = min(height, lower + pad)
    
    cropped = img.crop((left, upper, right, lower))
    buf = io.BytesIO()
    cropped.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")

def main():
    doc = fitz.open(pdf_path)
    all_questions = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=150)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        # Convert image to bytes for gemini
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_bytes = img_byte_arr.getvalue()
        
        prompt = """You are a visual layout extractor for exam papers.
Find all questions on this page.
For each question:
- id: question number
- type: "mcq" or "numerical"
- subject: inferred subject
- answer: correct option/value if indicated, else null
- stem_box: bounding box of the question text and diagrams (excluding options) as [ymin, xmin, ymax, xmax] scaled to 1000.
- options: For MCQs, list options with their id (A, B, etc) and bounding box.

Return ONLY a JSON object with a "questions" array.
"""
        
        try:
            response = model.generate_content([
                prompt,
                {"mime_type": "image/png", "data": img_bytes}
            ], generation_config={"response_mime_type": "application/json"})
            
            data = json.loads(response.text)
            
            for q in data.get("questions", []):
                # Crop stem
                if "stem_box" in q and len(q["stem_box"]) == 4:
                    q["stem_image"] = get_base64_crop(img, q["stem_box"])
                
                # Crop options
                for opt in q.get("options", []):
                    if "box" in opt and len(opt["box"]) == 4:
                        opt["image"] = get_base64_crop(img, opt["box"])
                
                all_questions.append(q)
        except Exception as e:
            # Skip page on error
            pass

    print(json.dumps({"questions": all_questions}))

if __name__ == "__main__":
    main()
