import sys
import os
import json
import time
from PIL import Image, ImageDraw, ImageFont

# Attempt to load pix2text
try:
    from pix2text import Pix2Text
    HAS_P2T = True
except ImportError:
    HAS_P2T = False
    print("Warning: Pix2Text not installed. Mocking math extraction.", file=sys.stderr)

def needs_math_ocr(text, confidence):
    # Heuristic: if OCR is low confidence, or contains math-specific characters
    math_chars = ['=', '+', '-', '/', '^', '{', '}', '_', '\\', '(', ')', '[', ']', 'sin', 'cos', 'tan', 'log']
    
    if confidence < 0.85:
        return True
        
    for char in math_chars:
        if char in text:
            return True
            
    # Check if there are numbers mixed closely with letters (e.g. 2x, x2)
    has_digit = any(c.isdigit() for c in text)
    has_alpha = any(c.isalpha() for c in text)
    if has_digit and has_alpha and len(text) < 15: # Short mixed strings are usually formulas
        return True
        
    return False

def generate_math_debug(orig_img_path, math_results, out_path):
    try:
        img = Image.open(orig_img_path).convert("RGBA")
        overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
        draw = ImageDraw.Draw(overlay)
        
        for res in math_results:
            bbox = res["bbox"]
            text = res["math_text"]
            conf = res["confidence"]
            
            # Purple box for Math
            draw.rectangle(bbox, fill=(128, 0, 128, 40), outline=(128, 0, 128, 255), width=2)
            
            preview = text[:25] + "..." if len(text) > 25 else text
            label = f"[MATH {conf:.2f}] {preview}"
            draw.text((bbox[0], max(0, bbox[1] - 15)), label, fill=(0, 0, 0, 255))
            
        out_img = Image.alpha_composite(img, overlay)
        out_img.convert("RGB").save(out_path, format="PNG")
    except Exception as e:
        print(f"Failed to generate Math OCR visual debug: {e}")

def main():
    if len(sys.argv) < 3:
        print("Usage: python stage4_math.py <pdf_path> <job_id>", file=sys.stderr)
        sys.exit(1)
        
    job_id = sys.argv[2] if len(sys.argv) > 2 else sys.argv[1]
    if len(sys.argv) >= 3:
        job_id = sys.argv[2]
        
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    ocr_path = os.path.join(base_dir, "ocr.json")
    
    if not os.path.exists(ocr_path):
        print("Error: ocr.json not found. Run Stage 3 first.", file=sys.stderr)
        sys.exit(1)
        
    with open(ocr_path, "r", encoding="utf-8") as f:
        ocr_data = json.load(f)
        
    # Initialize Pix2Text
    p2t = None
    if HAS_P2T:
        print("Initializing Pix2Text Math Model...")
        p2t = Pix2Text.from_config()
        
    math_data = {
        "job_id": job_id,
        "pages": []
    }
    
    for page_data in ocr_data["pages"]:
        page_num = page_data["page"]
        regions = page_data["regions"]
        
        page_img_path = os.path.join(base_dir, "pages", f"page_{page_num:03d}.png")
        math_results = []
        
        print(f"Processing Math OCR for Page {page_num}...")
        start_time = time.time()
        
        for region in regions:
            rtype = region["type"]
            text = region["text"]
            conf = region["confidence"]
            bbox = region["bbox"]
            asset_path = region["assetPath"]
            
            # Absolute path to the cropped asset
            abs_asset_path = os.path.join(os.getcwd(), "public", asset_path.lstrip("/"))
            
            # We skip diagrams
            if rtype == "Image":
                continue
                
            if needs_math_ocr(text, conf):
                math_text = ""
                math_conf = 0.0
                
                if HAS_P2T and os.path.exists(abs_asset_path):
                    try:
                        # Call Pix2Text
                        res = p2t.recognize(abs_asset_path, return_text=True)
                        math_text = res
                        math_conf = 0.95 # Pix2Text doesn't natively return global confidence easily, mocked to 0.95
                    except Exception as e:
                        print(f"Pix2Text error on {region['id']}: {e}")
                        math_text = f"$$ {text} $$"
                        math_conf = conf
                else:
                    # Mock behavior for architecture proof if pix2text is missing
                    math_text = f"\\text{{mock math: }} {text}"
                    math_conf = conf
                    
                math_results.append({
                    "id": region["id"],
                    "type": rtype,
                    "bbox": bbox,
                    "assetPath": asset_path,
                    "math_text": math_text,
                    "confidence": math_conf
                })
                
        elapsed = time.time() - start_time
        print(f"Page {page_num} Math OCR Complete in {elapsed:.2f}s | Processed {len(math_results)} regions.")
        
        # Debug Overlay
        no_debug = "--no-debug" in sys.argv
        if not no_debug:
            debug_path = os.path.join(base_dir, "pages", f"page_{page_num:03d}_math_debug.png")
            generate_math_debug(page_img_path, math_results, debug_path)
            print(f"Saved Math visual debug to {debug_path}")
        
        math_data["pages"].append({
            "page": page_num,
            "math_regions": math_results
        })
        
    math_path = os.path.join(base_dir, "math.json")
    with open(math_path, "w", encoding="utf-8") as f:
        json.dump(math_data, f, indent=2)
        
    print(f"Math OCR Pipeline complete. Outputs saved to {math_path}")

if __name__ == "__main__":
    main()
