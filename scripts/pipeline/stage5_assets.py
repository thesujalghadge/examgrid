import sys
import os
import json
from PIL import Image

def main():
    if len(sys.argv) < 3:
        print("Usage: python stage5_assets.py <job_id>", file=sys.stderr)
        sys.exit(1)
        
    job_id = sys.argv[2] # since python is index 0
    # actually wait, if run as python stage5_assets.py pdf_path job_id
    job_id = sys.argv[2]
    
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    layout_path = os.path.join(base_dir, "layout.json")
    pages_dir = os.path.join(base_dir, "pages")
    questions_dir = os.path.join(base_dir, "questions")
    
    if not os.path.exists(layout_path):
        print("Error: layout.json not found. Run Stage 2 first.", file=sys.stderr)
        sys.exit(1)
        
    os.makedirs(questions_dir, exist_ok=True)
        
    with open(layout_path, "r", encoding="utf-8") as f:
        layout_data = json.load(f)
        
    for page_data in layout_data["pages"]:
        page_num = page_data["page_num"]
        page_img_path = os.path.join(pages_dir, f"page_{page_num:03d}.png")
        
        if not os.path.exists(page_img_path):
            continue
            
        try:
            img = Image.open(page_img_path)
            
            for region in page_data["regions"]:
                x0, y0, x1, y1 = region["bbox"]
                
                # Add padding
                pad = 5
                left = max(0, x0 - pad)
                upper = max(0, y0 - pad)
                right = min(img.width, x1 + pad)
                lower = min(img.height, y1 + pad)
                
                cropped = img.crop((left, upper, right, lower))
                
                # Naming format: q_{region_id}.webp
                filename = f"{region['id']}.webp"
                filepath = os.path.join(questions_dir, filename)
                cropped.save(filepath, format="WEBP", quality=90)
                
            print(f"Generated {len(page_data['regions'])} assets for Page {page_num}")
        except Exception as e:
            print(f"Error processing Page {page_num}: {e}")
            
    print(f"Asset generation complete. Saved to {questions_dir}")

if __name__ == "__main__":
    main()
