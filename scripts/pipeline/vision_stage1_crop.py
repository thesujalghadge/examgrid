import sys
import os
import fitz
from PIL import Image, ImageChops
import json
import re

def trim_image_whitespace(im, padding=15):
    bg = Image.new(im.mode, im.size, (255, 255, 255))
    diff = ImageChops.difference(im, bg)
    diff = ImageChops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        _, upper, _, lower = bbox
        left = 0
        upper = max(0, upper - padding)
        right = im.width
        lower = min(im.height, lower + padding)
        return im.crop((left, upper, right, lower))
    return im

def main():
    if len(sys.argv) < 3:
        print("Usage: python vision_stage1_crop.py <pdf_path> <job_id>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    job_id = sys.argv[2]
    
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    crops_dir = os.path.join(base_dir, "vision_crops")
    os.makedirs(crops_dir, exist_ok=True)
    
    doc = fitz.open(pdf_path)
    
    crops_meta = {
        "job_id": job_id,
        "questions": []
    }
    
    # Regex to match question markers like "Q1.", "Q 1.", "1.", "1)"
    # For MathonGo it usually is "Q1." or "Q2."
    # We will search for standard numerical progression.
    expected_q = 1
    
    all_markers = []
    
    # Phase 1: Document-Wide Anchor Detection
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text_dict = page.get_text("dict")
        
        for block in text_dict.get("blocks", []):
            if "lines" not in block: continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    # Anchor Detection V1 - Generalized question boundary detection
                    match = re.match(r'^(?:Q(?:ue(?:stion)?)?|Prob(?:lem)?|Item)?\s*\.?\s*0*(\d+)\s*[\.\):-]', text, re.IGNORECASE)
                    if match:
                        q_num = int(match.group(1))
                        # Only accept if it's the expected question or slightly ahead (to handle missing numbers)
                        if q_num >= expected_q and q_num <= expected_q + 5:
                            all_markers.append({
                                "q_num": q_num,
                                "page_num": page_num,
                                "y0": span["bbox"][1]
                            })
                            expected_q = q_num + 1
                            
    # Sort markers by page number, then Y coordinate
    all_markers.sort(key=lambda x: (x["page_num"], x["y0"]))
    
    if not all_markers:
        print("No questions found.")
        sys.exit(0)
        
    print(f"Found {len(all_markers)} questions across the document.")
        
    # Phase 2: Multi-Page Question Stitching
    zoom = 3.0 # 216 DPI
    mat = fitz.Matrix(zoom, zoom)
    
    for i, marker in enumerate(all_markers):
        q_num = marker["q_num"]
        start_page_num = marker["page_num"]
        start_y = marker["y0"]
        
        if i + 1 < len(all_markers):
            end_page_num = all_markers[i+1]["page_num"]
            end_y = max(0, all_markers[i+1]["y0"] - 10) # 10px margin before next question
        else:
            end_page_num = len(doc) - 1
            end_page = doc.load_page(end_page_num)
            end_y = end_page.rect.height - 50 # 50px margin at bottom
            
        padding_top = 10
        start_y = max(0, start_y - padding_top)
        
        pieces = []
        
        # Stitch across pages
        for p in range(start_page_num, end_page_num + 1):
            page = doc.load_page(p)
            pix = page.get_pixmap(matrix=mat)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            
            p_start_y = 0
            p_end_y = page.rect.height
            
            if p == start_page_num:
                p_start_y = start_y
            if p == end_page_num:
                p_end_y = end_y
                
            if p_start_y < p_end_y:
                img_start_y = int(p_start_y * zoom)
                img_end_y = int(p_end_y * zoom)
                img_width = int(page.rect.width * zoom)
                
                crop_box = (0, img_start_y, img_width, img_end_y)
                cropped_img = img.crop(crop_box)
                trimmed_piece = trim_image_whitespace(cropped_img)
                pieces.append(trimmed_piece)
                
                # Save intermediate pieces for evidence
                if start_page_num != end_page_num:
                    piece_path = os.path.join(crops_dir, f"Q{q_num}_piece_{p-start_page_num}.jpg")
                    cropped_img.save(piece_path, "JPEG", quality=90)
                
        if not pieces:
            continue
            
        # Assemble pieces vertically
        total_height = sum(piece.height for piece in pieces)
        max_width = max(piece.width for piece in pieces)
        
        stitched_img = Image.new('RGB', (max_width, total_height), (255, 255, 255))
        y_offset = 0
        for piece in pieces:
            stitched_img.paste(piece, (0, y_offset))
            y_offset += piece.height
            
        # Extract text for MCQ/NAT classification and structured data within bounds
        q_text_raw = ""
        for p in range(start_page_num, end_page_num + 1):
            page = doc.load_page(p)
            p_start_y = 0
            p_end_y = page.rect.height
            if p == start_page_num:
                p_start_y = start_y
            if p == end_page_num:
                p_end_y = end_y
            rect = fitz.Rect(0, p_start_y, page.rect.width, p_end_y)
            q_text_raw += page.get_text("text", clip=rect) + "\n"
            
        # Try to extract options cleanly
        opt_A = re.search(r'\([A]\)\s*([^\n]+)', q_text_raw)
        opt_B = re.search(r'\([B]\)\s*([^\n]+)', q_text_raw)
        opt_C = re.search(r'\([C]\)\s*([^\n]+)', q_text_raw)
        opt_D = re.search(r'\([D]\)\s*([^\n]+)', q_text_raw)
        
        if not opt_A: opt_A = re.search(r'\([1]\)\s*([^\n]+)', q_text_raw)
        if not opt_B: opt_B = re.search(r'\([2]\)\s*([^\n]+)', q_text_raw)
        if not opt_C: opt_C = re.search(r'\([3]\)\s*([^\n]+)', q_text_raw)
        if not opt_D: opt_D = re.search(r'\([4]\)\s*([^\n]+)', q_text_raw)
        
        extracted_options = []
        for o in [opt_A, opt_B, opt_C, opt_D]:
            if o and len(o.group(1).strip()) > 0:
                # remove trailing bullet dots if any
                clean_opt = o.group(1).strip()
                if clean_opt.endswith(''): clean_opt = clean_opt[:-1].strip()
                extracted_options.append(clean_opt)
                
        # The question text is everything before the first option
        first_opt_match = re.search(r'(\n\s*)?\([A1]\)\s*', q_text_raw)
        if first_opt_match:
            question_stem_text = q_text_raw[:first_opt_match.start()].strip()
        else:
            question_stem_text = q_text_raw.strip()
            
        # Clean up question text (remove standard Question headers)
        question_stem_text = re.sub(r'^Question\s*\d+\s*:\s*', '', question_stem_text, flags=re.IGNORECASE)
        question_stem_text = re.sub(r'^Q\s*\d+\s*\.?\s*', '', question_stem_text, flags=re.IGNORECASE)
            
        q_type = "MCQ" if len(extracted_options) >= 3 else "NAT"
        
        crop_filename = f"Q{q_num}_crop.jpg"
        crop_path = os.path.join(crops_dir, crop_filename)
        rel_path = f"/uploads/cbt_assets/{job_id}/vision_crops/{crop_filename}"
        
        stitched_img = trim_image_whitespace(stitched_img)
        stitched_img.save(crop_path, "JPEG", quality=90)
        
        crops_meta["questions"].append({
            "id": f"Q{q_num}",
            "q_num": q_num,
            "q_type": q_type,
            "page": start_page_num + 1,
            "crop_path": crop_path,
            "asset_path": rel_path,
            "question_text": question_stem_text,
            "options": extracted_options
        })
        
        if start_page_num != end_page_num:
            print(f"Generated stitched crop for Q{q_num} (pages {start_page_num+1}-{end_page_num+1})")
        else:
            print(f"Generated crop for Q{q_num} (page {start_page_num+1})")
            
    meta_path = os.path.join(base_dir, "crops_meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(crops_meta, f, indent=2)
        
    print(f"Generated {len(crops_meta['questions'])} question crops.")
    print(f"Saved crops metadata to {meta_path}")

if __name__ == "__main__":
    main()
