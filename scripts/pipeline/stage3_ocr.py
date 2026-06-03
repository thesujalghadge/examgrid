import sys
import os
import json
import fitz

def extract_ocr(doc, page_num, regions):
    page = doc[page_num]
    # In production, this would call Surya OCR on the cropped regions.
    # For architecture proof, we extract text within the bounding boxes using PyMuPDF.
    
    ocr_results = []
    for region in regions:
        if region["type"] == "Image":
            continue
            
        x0, y0, x1, y1 = region["bbox"]
        rect = fitz.Rect(x0, y0, x1, y1)
        text = page.get_text("text", clip=rect).strip()
        
        if text:
            ocr_results.append({
                "region_id": region["id"],
                "text": text,
                "confidence": 0.99
            })
            
    return ocr_results

def main():
    if len(sys.argv) < 3:
        print("Usage: python stage3_ocr.py <pdf_path> <job_id>", file=sys.stderr)
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    job_id = sys.argv[2]
    
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    layout_path = os.path.join(base_dir, "layout.json")
    
    if not os.path.exists(layout_path):
        print("Error: layout.json not found. Run Stage 2 first.", file=sys.stderr)
        sys.exit(1)
        
    with open(layout_path, "r", encoding="utf-8") as f:
        layout_data = json.load(f)
        
    doc = fitz.open(pdf_path)
    
    ocr_data = {
        "job_id": job_id,
        "pages": []
    }
    
    for page_data in layout_data["pages"]:
        page_num = page_data["page_num"] - 1
        regions = page_data["regions"]
        
        ocr_results = extract_ocr(doc, page_num, regions)
        ocr_data["pages"].append({
            "page_num": page_num + 1,
            "ocr": ocr_results
        })
        print(f"Extracted {len(ocr_results)} text blocks on Page {page_num + 1}")
        
    ocr_path = os.path.join(base_dir, "ocr.json")
    with open(ocr_path, "w", encoding="utf-8") as f:
        json.dump(ocr_data, f, indent=2)
        
    print(f"OCR complete. Saved to {ocr_path}")

if __name__ == "__main__":
    main()
