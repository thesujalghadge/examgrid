import fitz
import json
import os
import re

pdf_path = r'C:\Users\SOURAV\AppData\Local\Temp\examgrid-vis-FzYUf3\paper.pdf'
layout_path = r'C:\AI\examgrid\public\uploads\cbt_assets\benchmark_inst\job_benchmark_002\layout.json'

with open(layout_path, 'r', encoding='utf-8') as f:
    layout = json.load(f)

doc = fitz.open(pdf_path)
scale = 72.0 / 300.0

total_regions = 0
pdf_text_recoverable = 0
math_ocr_required = 0
image_ocr_required = 0

MATH_CHARS = set("∫∑√≤≥±≠∈△παβθγλμΔ∇∞~≈∝")

def is_formula_heavy(text):
    if any(c in text for c in MATH_CHARS):
        return True
    
    # Check for isolated numbers or single letters mixed heavily (a proxy for algebra)
    # This is a bit crude but works for a quick audit.
    if re.search(r'\b[a-zA-Z]\d+\b', text): # e.g. x2, a1
        return True
    
    if re.search(r'[=+/*^]', text):
        return True
        
    return False

report_lines = []

for p_data in layout['pages']:
    page_num = p_data['page_num'] - 1
    page = doc[page_num]
    
    for r in p_data['regions']:
        if r['type'] == 'Image':
            image_ocr_required += 1
            total_regions += 1
            continue
            
        x0, y0, x1, y1 = r['bbox']
        pdf_rect = fitz.Rect(x0 * scale, y0 * scale, x1 * scale, y1 * scale)
        text = page.get_text('text', clip=pdf_rect).strip()
        
        total_regions += 1
        
        if not text:
            image_ocr_required += 1
        else:
            if is_formula_heavy(text):
                math_ocr_required += 1
                if r['id'].startswith('stem') and len(report_lines) < 20:
                    report_lines.append(f"{r['id']} -> Formula Heavy. Sample: {text[:50].replace(chr(10), ' ')}")
            else:
                pdf_text_recoverable += 1

report = f"""
==================================================
EXTRACTION AUDIT REPORT
==================================================
Total Regions Audited: {total_regions}

1. PDF Text Layer (Standard): {pdf_text_recoverable} ({(pdf_text_recoverable/total_regions)*100:.1f}%)
2. Math OCR Required:         {math_ocr_required} ({(math_ocr_required/total_regions)*100:.1f}%)
3. Image OCR Required:        {image_ocr_required} ({(image_ocr_required/total_regions)*100:.1f}%)

Sample Math Heavy Regions:
""" + "\n".join(report_lines)

print(report)

with open(r'C:\AI\examgrid\extraction_audit.txt', 'w', encoding='utf-8') as f:
    f.write(report)
