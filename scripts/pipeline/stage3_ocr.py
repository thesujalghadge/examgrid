import sys
import os
import json
import time
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import easyocr

def crop_region_asset(img, bbox, region_id, output_dir):
    x0, y0, x1, y1 = bbox
    pad = 5
    left = max(0, x0 - pad)
    upper = max(0, y0 - pad)
    right = min(img.width, x1 + pad)
    lower = min(img.height, y1 + pad)
    
    cropped = img.crop((left, upper, right, lower))
    asset_name = f"{region_id}.webp"
    asset_path = os.path.join(output_dir, asset_name)
    cropped.save(asset_path, format="WEBP", quality=95)
    return asset_name, asset_path, cropped

def run_ocr_on_crop(cropped_img, reader):
    try:
        # Convert PIL Image to numpy array (RGB)
        img_np = np.array(cropped_img)
        
        # EasyOCR returns list of (bbox, text, prob)
        results = reader.readtext(img_np)
        
        text_lines = []
        confidences = []
        
        for (bbox, text, prob) in results:
            text = text.strip()
            if text:
                text_lines.append(text)
                confidences.append(prob)
                
        # Join words into single text string for the region
        combined_text = " ".join(text_lines) if text_lines else ""
        avg_conf = (sum(confidences) / len(confidences)) if confidences else 0.0
        
        return combined_text, avg_conf
    except Exception as e:
        print(f"OCR Error: {e}", file=sys.stderr)
        return "", 0.0

def generate_ocr_debug(orig_img_path, ocr_results, out_path):
    try:
        img = Image.open(orig_img_path).convert("RGBA")
        overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        
        for res in ocr_results:
            bbox = res["bbox"]
            text = res["text"]
            conf = res["confidence"]
            
            # Draw semi-transparent box
            draw.rectangle(bbox, fill=(255, 255, 0, 30), outline=(255, 165, 0, 255), width=2)
            
            # Draw short preview text and conf
            preview = text[:30] + "..." if len(text) > 30 else text
            label = f"[{conf:.2f}] {preview}"
            draw.text((bbox[0], max(0, bbox[1] - 15)), label, fill=(0, 0, 0, 255))
            
        out_img = Image.alpha_composite(img, overlay)
        out_img.convert("RGB").save(out_path, format="PNG")
    except Exception as e:
        print(f"Failed to generate OCR visual debug: {e}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python stage3_ocr.py <pdf_path> <job_id>", file=sys.stderr)
        sys.exit(1)
        
    job_id = sys.argv[2] if len(sys.argv) > 2 else sys.argv[1]
    
    # Check if job_id is actually the second argument in orchestrator
    if len(sys.argv) >= 3:
        job_id = sys.argv[2]
    
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    layout_path = os.path.join(base_dir, "layout.json")
    regions_dir = os.path.join(base_dir, "regions")
    
    os.makedirs(regions_dir, exist_ok=True)
    
    if not os.path.exists(layout_path):
        print("Error: layout.json not found. Run Stage 2 first.", file=sys.stderr)
        sys.exit(1)
        
    with open(layout_path, "r", encoding="utf-8") as f:
        layout_data = json.load(f)
        
    
    # Initialize EasyOCR reader once
    print("Initializing EasyOCR Model...")
    reader = easyocr.Reader(['en'], gpu=False)
    
    ocr_data = {
        "job_id": job_id,
        "pages": []
    }
    
    for page_data in layout_data["pages"]:
        page_num = page_data["page_num"]
        regions = page_data["regions"]
        
        # Load the original rendered page image
        page_img_path = os.path.join(base_dir, "pages", f"page_{page_num:03d}.png")
        if not os.path.exists(page_img_path):
            continue
            
        img = Image.open(page_img_path)
        ocr_results = []
        
        print(f"Processing OCR for {len(regions)} regions on Page {page_num}...")
        
        start_time = time.time()
        failed_regions = 0
        
        for idx, region in enumerate(regions):
            region_id = region["id"]
            rtype = region["type"]
            bbox = region["bbox"]
            
            # Step 1: Deterministic Visual Crop
            asset_name, asset_path, cropped_img = crop_region_asset(img, bbox, region_id, regions_dir)
            
            # Step 2: Isolated Region OCR
            text = ""
            conf = 0.0
            
            if rtype in ["QuestionStem", "Option"]:
                text, conf = run_ocr_on_crop(cropped_img, reader)
                if not text:
                    failed_regions += 1
            elif rtype == "Image":
                text = "[DIAGRAM]"
                conf = 1.0
                
            ocr_results.append({
                "id": region_id,
                "type": rtype,
                "bbox": bbox,
                "assetPath": f"/uploads/cbt_assets/{job_id}/regions/{asset_name}",
                "text": text,
                "confidence": conf,
                "readingOrder": idx
            })
            
        # Logging observability
        elapsed = time.time() - start_time
        avg_conf = sum(r["confidence"] for r in ocr_results) / len(ocr_results) if ocr_results else 0
        print(f"Page {page_num} OCR Complete in {elapsed:.2f}s | Avg Conf: {avg_conf:.2f} | Empty/Failed: {failed_regions}")
        
        # Debug Overlay
        no_debug = "--no-debug" in sys.argv
        if not no_debug:
            debug_path = os.path.join(base_dir, "pages", f"page_{page_num:03d}_ocr_debug.png")
            generate_ocr_debug(page_img_path, ocr_results, debug_path)
            print(f"Saved OCR visual debug to {debug_path}")
        
        ocr_data["pages"].append({
            "page": page_num,
            "regions": ocr_results
        })
        
    ocr_path = os.path.join(base_dir, "ocr.json")
    with open(ocr_path, "w", encoding="utf-8") as f:
        json.dump(ocr_data, f, indent=2)
        
    print(f"OCR Pipeline complete. Structured extraction saved to {ocr_path}")

if __name__ == "__main__":
    main()
