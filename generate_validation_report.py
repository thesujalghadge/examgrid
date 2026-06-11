import os
import json

base_dir = r"C:\AI\examgrid\public\uploads\cbt_assets\benchmark_inst\job_benchmark_002"
out_report = r"C:\Users\SOURAV\.gemini\antigravity\brain\3d544433-5552-40ec-8232-542f70f2371c\validation_report.md"

def load_json(filename):
    with open(os.path.join(base_dir, filename), "r", encoding="utf-8") as f:
        return json.load(f)

layout = load_json("layout.json")
ocr = load_json("ocr.json")
math_data = load_json("math.json")
semantic = load_json("semantic.json")

targets = [1, 2, 20, 50, 75]

report = "# Pre-Execution Pipeline Validation\n\n"

# OVERALL METRICS
questions = semantic.get("questions", [])
q_count = len(questions)
option_count = sum(len(q.get("options", [])) for q in questions)
diagram_count = sum(len(q.get("images", [])) for q in questions)
nat_count = sum(1 for q in questions if q.get("type") == "numerical")
mcq_count = q_count - nat_count

layout_images = sum(1 for p in layout.get("pages", []) for r in p.get("regions", []) if r["type"] == "Image")

missing_options = [q["id"] for q in questions if q.get("type") in ["mcq", "multi_correct"] and len(q.get("options", [])) < 4]
missing_qs = 90 - q_count # Based on standard JEE 90-question paper

report += "## Pipeline Metrics\n\n"
report += f"- **Question Count:** {q_count} (Expected: ~90 if all sections extracted, 75 if attempted only. Result: {'✅' if q_count >= 75 else '❌'})\n"
report += f"- **Option Count:** {option_count} (Average: {option_count/mcq_count:.2f} per MCQ)\n"
report += f"- **NAT Count:** {nat_count}\n"
report += f"- **Diagram Count:** {diagram_count} (Layout detected {layout_images} images)\n"
report += f"- **Missing Options (MCQs with <4 options):** {len(missing_options)} {missing_options}\n"
report += "---\n\n"

def get_region_data(source_json, region_id, page_num):
    # Depending on the JSON structure, try to find the region
    for p in source_json.get("pages", []):
        if p.get("page") == page_num or p.get("page_num") == page_num:
            for r in p.get("regions", p.get("math_regions", [])):
                if r["id"] == region_id:
                    return r
    return None

for qnum in targets:
    report += f"## Question {qnum}\n\n"
    q_sem = next((x for x in questions if str(x["id"]) == str(qnum) or str(x["id"]) == f"Q{qnum}"), None)
    
    if not q_sem:
        report += f"**❌ Question {qnum} NOT FOUND in semantic output.**\n\n"
        continue
        
    region_ids = q_sem.get("metadata", {}).get("regionIds", [])
    
    import shutil
    
    # 1. PDF Source
    # We can infer the page from the first region ID
    # e.g., p1_stem_1 -> page 1
    page_num = 1
    clean_rids = []
    for rid in region_ids:
        if rid.startswith("p"):
            parts = rid.split("_", 1)
            page_num = int(parts[0].replace("p", ""))
            clean_rids.append(parts[1])
        else:
            clean_rids.append(rid)
            
    src_page_img = os.path.join(base_dir, "pages", f"page_{page_num:03d}.png")
    dst_page_img = os.path.join(r"C:\Users\SOURAV\.gemini\antigravity\brain\3d544433-5552-40ec-8232-542f70f2371c", f"page_{page_num:03d}.png")
    
    if os.path.exists(src_page_img):
        shutil.copy(src_page_img, dst_page_img)
        
    report += f"### PDF Source (Page {page_num})\n"
    # Convert windows path to absolute artifact path starting with /
    unix_path = dst_page_img.replace(chr(92), '/')
    report += f"![Page {page_num}](/{unix_path})\n\n"
    
    # 2. Layout Output
    report += "### Layout Output\n```json\n[\n"
    layout_regions = []
    for rid in clean_rids:
        r = get_region_data(layout, rid, page_num)
        if r: layout_regions.append(r)
    report += ",\n".join([json.dumps(r, indent=2) for r in layout_regions])
    report += "\n]\n```\n\n"
    
    # 3. OCR Output
    report += "### OCR Output\n```json\n[\n"
    ocr_regions = []
    for rid in clean_rids:
        r = get_region_data(ocr, rid, page_num)
        if r: ocr_regions.append(r)
    report += ",\n".join([json.dumps(r, indent=2) for r in ocr_regions])
    report += "\n]\n```\n\n"
    
    # 4. Math Output
    report += "### Math Output\n```json\n[\n"
    math_regions = []
    for rid in clean_rids:
        r = get_region_data(math_data, rid, page_num)
        if r: math_regions.append(r)
    report += ",\n".join([json.dumps(r, indent=2) for r in math_regions])
    report += "\n]\n```\n\n"
    
    # 5. Semantic Output & 6. Final Question JSON
    report += "### Final Semantic Question JSON\n```json\n"
    report += json.dumps(q_sem, indent=2)
    report += "\n```\n\n---\n\n"
    
with open(out_report, "w", encoding="utf-8") as f:
    f.write(report)
    
print("Validation report generated.")
