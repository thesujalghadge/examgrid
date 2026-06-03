import sys
import os
import json
import fitz
import cv2
import numpy as np
from PIL import Image, ImageDraw

def rect_merge(r1, r2):
    return [min(r1[0], r2[0]), min(r1[1], r2[1]), max(r1[2], r2[2]), max(r1[3], r2[3])]

def detect_layout_cv2(img_path):
    img = cv2.imread(img_path)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Binarize
    _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY_INV)
    
    # Remove watermarks/noise by opening
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    clean = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
    
    # Dilate horizontally to connect text characters into lines
    line_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 5))
    lines_mask = cv2.dilate(clean, line_kernel, iterations=1)
    
    # Dilate vertically to connect lines into paragraphs/blocks
    block_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 20))
    blocks_mask = cv2.dilate(lines_mask, block_kernel, iterations=1)
    
    contours, _ = cv2.findContours(blocks_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    blocks = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w > 10 and h > 10:
            blocks.append([x, y, x + w, y + h])
            
    # Sort blocks top-to-bottom
    blocks.sort(key=lambda b: b[1])
    
    regions = []
    current_q_stem = None
    q_counter = 0
    opt_counter = 0
    
    for i, b in enumerate(blocks):
        w = b[2] - b[0]
        h = b[3] - b[1]
        
        # Heuristic 1: Very large regions might be diagrams or large equations
        if h > 200:
            regions.append({"id": f"img_{i}", "type": "Image", "bbox": b})
            continue
            
        # Heuristic 2: Options are usually narrow, arranged in grids
        # If it's relatively small and there are other blocks on similar Y level
        siblings_on_y = [other for other in blocks if other != b and abs(other[1] - b[1]) < 30]
        
        if len(siblings_on_y) > 0 and w < img.shape[1] * 0.4:
            opt_counter += 1
            regions.append({"id": f"opt_{opt_counter}", "type": "Option", "bbox": b})
        else:
            # Assume question stem text block
            q_counter += 1
            regions.append({"id": f"stem_{q_counter}", "type": "QuestionStem", "bbox": b})
            
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
    
    for page_meta in meta_data["pages"]:
        page_num = page_meta["page_num"] - 1
        orig_img_path = page_meta["path"]
        
        # Use OpenCV CV2 to detect layout on the raw image
        regions = detect_layout_cv2(orig_img_path)
        
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
