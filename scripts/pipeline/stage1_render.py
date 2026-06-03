import sys
import os
import json
import fitz  # PyMuPDF
from PIL import Image

def main():
    if len(sys.argv) < 3:
        print("Usage: python stage1_render.py <pdf_path> <job_id>", file=sys.stderr)
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    job_id = sys.argv[2]
    
    max_pages = None
    if len(sys.argv) > 3 and sys.argv[3].startswith("--max-pages="):
        max_pages = int(sys.argv[3].split("=")[1])
    
    # Setup directories
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    pages_dir = os.path.join(base_dir, "pages")
    os.makedirs(pages_dir, exist_ok=True)
    
    print(f"Opening PDF: {pdf_path}")
    doc = fitz.open(pdf_path)
    
    num_pages = len(doc)
    if max_pages and max_pages < num_pages:
        print(f"Limiting render to first {max_pages} pages for fast demo execution.")
        num_pages = max_pages
        
    metadata = {
        "job_id": job_id,
        "total_pages": num_pages,
        "pages": []
    }
    
    for page_num in range(num_pages):
        page = doc[page_num]
        
        # High-res render for layout/OCR (300 DPI)
        pix = page.get_pixmap(dpi=300)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        
        filename = f"page_{page_num + 1:03d}.png"
        filepath = os.path.join(pages_dir, filename)
        img.save(filepath, format="PNG")
        
        metadata["pages"].append({
            "page_num": page_num + 1,
            "filename": filename,
            "width": img.width,
            "height": img.height,
            "path": filepath
        })
        print(f"Rendered Page {page_num + 1} -> {filename}")
        
    meta_path = os.path.join(base_dir, "render_meta.json")
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    print(f"Render complete. Metadata saved to {meta_path}")

if __name__ == "__main__":
    main()
