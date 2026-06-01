import sys
import json
import base64
import io
import fitz  # PyMuPDF
from PIL import Image
import re

def get_base64_crop(img: Image.Image, box) -> str:
    # box is [ymin, xmin, ymax, xmax] scaled to 1000
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

def extract_page_heuristics(page, img):
    blocks = page.get_text("dict")["blocks"]
    
    spans = []
    for b in blocks:
        if "lines" in b:
            for l in b["lines"]:
                for s in l["spans"]:
                    text = s["text"].strip()
                    if text:
                        # bbox is [x0, y0, x1, y1]
                        spans.append({"text": text, "bbox": s["bbox"]})
                        
    # Sort by Y, then by X
    spans.sort(key=lambda x: (x["bbox"][1], x["bbox"][0]))
    
    questions = []
    current_q = None
    
    # Common JEE markers
    q_pattern = re.compile(r'^(?:Q|Question)?\.?\s*(\d+)\.$')
    opt_pattern = re.compile(r'^\(?([A-D1-4])\)$|^(?:Option\s*)?([A-D1-4])\)$')
    
    for span in spans:
        text = span["text"]
        bbox = span["bbox"]
        
        q_match = q_pattern.match(text)
        opt_match = opt_pattern.match(text)
        
        if q_match:
            if current_q:
                questions.append(current_q)
            current_q = {
                "id": q_match.group(1),
                "type": "mcq",
                "subject": "Physics", # default, will be remapped by TS
                "top": bbox[1],
                "bottom": bbox[3],
                "left": bbox[0],
                "right": bbox[2],
                "options": [],
                "spans": [span]
            }
        elif current_q:
            if opt_match:
                opt_id = opt_match.group(1) or opt_match.group(2)
                current_q["options"].append({
                    "id": opt_id,
                    "top": bbox[1],
                    "left": bbox[0],
                    "bottom": bbox[3],
                    "right": bbox[2]
                })
                current_q["bottom"] = max(current_q["bottom"], bbox[3])
                current_q["right"] = max(current_q["right"], bbox[2])
            else:
                if len(current_q["options"]) == 0:
                    current_q["spans"].append(span)
                    current_q["bottom"] = max(current_q["bottom"], bbox[3])
                    current_q["right"] = max(current_q["right"], bbox[2])
                else:
                    last_opt = current_q["options"][-1]
                    last_opt["bottom"] = max(last_opt["bottom"], bbox[3])
                    last_opt["right"] = max(last_opt["right"], bbox[2])
                    
    if current_q:
        questions.append(current_q)
        
    width, height = img.size
    page_width = page.rect.width
    page_height = page.rect.height
    
    def normalize_box(box):
        x0, y0, x1, y1 = box
        return [
            (y0 / page_height) * 1000,
            (x0 / page_width) * 1000,
            (y1 / page_height) * 1000,
            (x1 / page_width) * 1000
        ]
        
    result = []
    for q in questions:
        left = min([s["bbox"][0] for s in q["spans"]])
        right = page_width
        
        stem_box = normalize_box([left, q["top"], right, q["bottom"]])
        stem_image = get_base64_crop(img, stem_box)
        
        parsed_opts = []
        for i, opt in enumerate(q["options"]):
            opt_right = page_width
            for other in q["options"][i+1:]:
                if abs(other["top"] - opt["top"]) < 20: # same line
                    opt_right = other["left"] - 5
                    break
            
            opt_box = normalize_box([opt["left"], opt["top"], opt_right, opt["bottom"] + 15])
            parsed_opts.append({
                "id": opt["id"],
                "image": get_base64_crop(img, opt_box)
            })
            
        result.append({
            "id": q["id"],
            "type": q["type"],
            "subject": q["subject"],
            "stem_image": stem_image,
            "options": parsed_opts
        })
        
    return result

def main():
    pdf_path = sys.argv[1]
    doc = fitz.open(pdf_path)
    all_questions = []

    for page_num in range(len(doc)):
        try:
            page = doc[page_num]
            pix = page.get_pixmap(dpi=300)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            qs = extract_page_heuristics(page, img)
            all_questions.extend(qs)
        except Exception as e:
            print(f"Error on page {page_num}: {str(e)}", file=sys.stderr)
            pass

    print(json.dumps({"questions": all_questions}))

if __name__ == "__main__":
    main()
