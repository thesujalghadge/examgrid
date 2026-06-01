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

class OptionBox(typing.TypedDict):
    id: str
    box: list[int]

class QuestionBox(typing.TypedDict):
    id: str
    type: str
    subject: str
    answer: str
    stem_box: list[int]
    options: list[OptionBox]

class ExtractResult(typing.TypedDict):
    questions: list[QuestionBox]

def get_base64_crop(img: Image.Image, box) -> str:
    # box is [ymin, xmin, ymax, xmax] normalized to 1000
    ymin, xmin, ymax, xmax = box
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

def main():
    doc = fitz.open(pdf_path)
    all_questions = []

    for page_num in range(len(doc)):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=300) # 300 DPI for high quality
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format='PNG')
        img_bytes = img_byte_arr.getvalue()
        
        prompt = """You are a visual layout extractor for exam papers.
Find all questions on this page.
For each question:
- id: question number
- type: "mcq" or "numerical"
- subject: inferred subject (Physics, Chemistry, Mathematics)
- answer: correct option ID or numerical value if indicated, else null
- stem_box: bounding box of the question text and any diagrams (EXCLUDING the options) as [ymin, xmin, ymax, xmax] scaled to 1000. Include the question number in the box.
- options: For MCQs, list EXACTLY all options with their id (A, B, C, D or 1, 2, 3, 4) and bounding box.

Make sure you do NOT miss the options. Each option must have a bounding box.
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
            
            for q in data.get("questions", []):
                if "stem_box" in q and len(q["stem_box"]) == 4:
                    q["stem_image"] = get_base64_crop(img, q["stem_box"])
                
                for opt in q.get("options", []):
                    if "box" in opt and len(opt["box"]) == 4:
                        opt["image"] = get_base64_crop(img, opt["box"])
                
                all_questions.append(q)
        except Exception as e:
            pass

    print(json.dumps({"questions": all_questions}))

if __name__ == "__main__":
    main()
