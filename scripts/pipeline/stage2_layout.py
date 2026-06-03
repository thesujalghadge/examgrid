import sys
import os
import json
import fitz

def detect_layout(doc, page_num):
    page = doc[page_num]
    # In production, this would call Surya Layout.
    # For deterministic pipeline architecture proof, we use PyMuPDF text blocks.
    blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_IMAGES)["blocks"]
    
    regions = []
    for i, block in enumerate(blocks):
        bbox = block["bbox"] # [x0, y0, x1, y1]
        
        region_type = "Text"
        if block.get("type") == 1:
            region_type = "Image"
        else:
            # Deterministic heuristic for questions/options based on text content
            text = ""
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    text += span["text"] + " "
                    
            text = text.strip()
            if text.startswith("Q") and any(c.isdigit() for c in text[:4]):
                region_type = "QuestionStem"
            elif text.startswith("(") and any(c.isdigit() for c in text[1:3]) and ")" in text[:5]:
                region_type = "Option"
                
        regions.append({
            "id": f"region_p{page_num+1}_{i}",
            "type": region_type,
            "bbox": bbox
        })
        
    return regions

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
        
    doc = fitz.open(pdf_path)
    
    layout_data = {
        "job_id": job_id,
        "pages": []
    }
    
    for page_num in range(len(doc)):
        regions = detect_layout(doc, page_num)
        layout_data["pages"].append({
            "page_num": page_num + 1,
            "regions": regions
        })
        print(f"Detected {len(regions)} layout regions on Page {page_num + 1}")
        
    layout_path = os.path.join(base_dir, "layout.json")
    with open(layout_path, "w", encoding="utf-8") as f:
        json.dump(layout_data, f, indent=2)
        
    print(f"Layout detection complete. Saved to {layout_path}")

if __name__ == "__main__":
    main()
