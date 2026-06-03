import sys
import os
import json
import fitz
import cv2
import numpy as np
from PIL import Image, ImageDraw
import easyocr

def rect_merge(r1, r2):
    return [min(r1[0], r2[0]), min(r1[1], r2[1]), max(r1[2], r2[2]), max(r1[3], r2[3])]

def extract_text_anchor(crop_img, reader):
    """Lightweight OCR to find anchors like Q29 or (1)"""
    try:
        # Convert crop to numpy array
        if isinstance(crop_img, Image.Image):
            crop_img = np.array(crop_img)
        # EasyOCR returns list of (bbox, text, prob)
        res = reader.readtext(crop_img, detail=0)
        return " ".join(res).strip()
    except:
        return ""

def is_question_anchor(text):
    text = text.strip()
    return (text.startswith("Q") and any(c.isdigit() for c in text[:4])) or \
           (text and text[0].isdigit() and "." in text[:4])

def is_option_anchor(text):
    text = text.strip()
    if text.startswith("(") and ")" in text[:5] and any(c.isalnum() for c in text[1:4]):
        return True
    if text.startswith("[") and "]" in text[:5]:
        return True
    return False

def detect_layout_cv2(img_path, reader):
    img = cv2.imread(img_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Aggressive watermark suppression
    # MathonGo watermarks are typically light gray. We use a harsh threshold (e.g., 180) to kill them.
    _, thresh = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY_INV)
    
    # Remove isolated noise pixels
    kernel_noise = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    clean = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel_noise, iterations=1)
    
    # Dilate horizontally to connect text characters into solid lines
    # Using a wide but short kernel so lines don't merge vertically
    line_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (50, 3))
    lines_mask = cv2.dilate(clean, line_kernel, iterations=2)
    
    # Find initial contours (lines or small blocks)
    contours, _ = cv2.findContours(lines_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    raw_blocks = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w > 15 and h > 10: # Filter out tiny noise
            raw_blocks.append([x, y, x + w, y + h])
            
    # Sort top-to-bottom
    raw_blocks.sort(key=lambda b: b[1])
    
    # Group lines into semantic blocks using vertical proximity and OCR anchors
    blocks = []
    current_block = None
    
    for b in raw_blocks:
        if not current_block:
            current_block = b
            continue
            
        # Check vertical gap
        gap = b[1] - current_block[3]
        
        # If gap is small, they belong to the same paragraph/block
        if gap < 25:
            current_block = rect_merge(current_block, b)
        else:
            blocks.append(current_block)
            current_block = b
            
    if current_block:
        blocks.append(current_block)
        
    regions = []
    q_counter = 0
    opt_counter = 0
    
    for i, b in enumerate(blocks):
        x0, y0, x1, y1 = b
        w = x1 - x0
        h = y1 - y0
        
        # Heuristic: Images / large diagrams
        if h > 150 and w > 150:
            regions.append({"id": f"img_{i}", "type": "Image", "bbox": b, "confidence": 0.9})
            continue
            
        # Lightweight OCR Anchor Detection
        # Crop the left side of the block to check for "Q." or "(1)"
        anchor_w = min(120, w)
        anchor_crop = gray[y0:y1, x0:x0+anchor_w]
        
        anchor_text = extract_text_anchor(anchor_crop, reader)
        
        if is_question_anchor(anchor_text):
            q_counter += 1
            regions.append({"id": f"stem_{q_counter}", "type": "QuestionStem", "bbox": b, "confidence": 0.8})
            continue
            
        if is_option_anchor(anchor_text):
            opt_counter += 1
            regions.append({"id": f"opt_{q_counter}_{opt_counter}", "type": "Option", "bbox": b, "confidence": 0.8})
            continue
            
        # If OCR fails or returns nothing, fallback to structural heuristics
        siblings_on_y = [other for other in blocks if other != b and abs(other[1] - y0) < 40]
        
        if len(siblings_on_y) > 0 and w < img.shape[1] * 0.45:
            opt_counter += 1
            regions.append({"id": f"opt_{q_counter}_{opt_counter}", "type": "Option", "bbox": b, "confidence": 0.6})
        else:
            q_counter += 1
            regions.append({"id": f"stem_{q_counter}", "type": "QuestionStem", "bbox": b, "confidence": 0.6})
            
    return regions

def draw_debug_overlay(img_path, regions, out_path):
    try:
        img = Image.open(img_path).convert("RGBA")
        overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        
        for region in regions:
            bbox = region["bbox"]
            rtype = region["type"]
            
            color = (0, 0, 0, 60)
            outline = (0, 0, 0, 255)
            
            if rtype == "QuestionStem":
                color = (255, 0, 0, 50) # Red
                outline = (255, 0, 0, 255)
            elif rtype == "Option":
                color = (0, 255, 0, 50) # Green
                outline = (0, 200, 0, 255)
            elif rtype == "Image":
                color = (0, 0, 255, 50) # Blue
                outline = (0, 0, 255, 255)
                
            draw.rectangle(bbox, fill=color, outline=outline, width=3)
            draw.text((bbox[0], max(0, bbox[1] - 15)), f"{rtype} ({region['id']})", fill=outline)
            
        out_img = Image.alpha_composite(img, overlay)
        out_img.convert("RGB").save(out_path, format="PNG")
    except Exception as e:
        print(f"Failed to generate visual debug: {e}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python stage2_layout.py <pdf_path> <job_id>", file=sys.stderr)
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    job_id = sys.argv[2]
    
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    meta_path = os.path.join(base_dir, "render_meta.json")
    
    if not os.path.exists(meta_path):
        print("Error: render_meta.json not found. Run Stage 1 first.", file=sys.stderr)
        sys.exit(1)
        
    with open(meta_path, "r", encoding="utf-8") as f:
        meta_data = json.load(f)
        
    layout_data = {
        "job_id": job_id,
        "pages": []
    }
    
    print("Initializing EasyOCR Model for Layout Anchor Detection...")
    reader = easyocr.Reader(['en'], gpu=False)
    
    for page_meta in meta_data["pages"]:
        page_num = page_meta["page_num"] - 1
        orig_img_path = page_meta["path"]
        
        # Use OpenCV CV2 to detect layout on the raw image
        regions = detect_layout_cv2(orig_img_path, reader)
        
        layout_data["pages"].append({
            "page_num": page_num + 1,
            "regions": regions
        })
        
        # Generate visual debug overlay
        debug_img_path = orig_img_path.replace(".png", "_debug.png")
        draw_debug_overlay(orig_img_path, regions, debug_img_path)
        
        print(f"Detected {len(regions)} layout regions on Page {page_num + 1}")
        print(f"Saved visual debug to {debug_img_path}")
        
    layout_path = os.path.join(base_dir, "layout.json")
    with open(layout_path, "w", encoding="utf-8") as f:
        json.dump(layout_data, f, indent=2)
        
    print(f"Layout detection complete. Saved to {layout_path}")

if __name__ == "__main__":
    main()
