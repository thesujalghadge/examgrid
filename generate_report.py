import sys
import os
import json
from pix2text import Pix2Text

base_dir = r'C:\AI\examgrid\public\uploads\cbt_assets\benchmark_inst\job_benchmark_002'
ocr_path = os.path.join(base_dir, 'ocr.json')

with open(ocr_path, 'r', encoding='utf-8') as f:
    ocr_data = json.load(f)

targets = {
  1: { 'page': 1, 'id': 'stem_2' },
  2: { 'page': 1, 'id': 'stem_3' },
  10: { 'page': 1, 'id': 'stem_16' },
  20: { 'page': 3, 'id': 'stem_2' },
  30: { 'page': 4, 'id': 'stem_5' },
  40: { 'page': 7, 'id': 'stem_2' },
  50: { 'page': 9, 'id': 'stem_2' },
  60: { 'page': 10, 'id': 'stem_7' },
  75: { 'page': 13, 'id': 'stem_2' }
}

p2t = Pix2Text.from_config()
math_outputs = {}

for qnum, info in targets.items():
    page_num = info['page']
    rid = info['id']
    
    region = None
    for p in ocr_data['pages']:
        if p['page'] == page_num:
            for r in p['regions']:
                if r['id'] == rid:
                    region = r
                    break
                    
    if region:
        abs_asset_path = os.path.join(os.getcwd(), "public", region["assetPath"].lstrip("/"))
        res = p2t.recognize(abs_asset_path, return_text=True)
        
        math_outputs[qnum] = {
            'stage3': region['text'],
            'stage4': res,
            'region_id': region['id'],
            'asset': region["assetPath"]
        }

report = "# CBT Final Fidelity Validation\n\n"
for qnum, outs in math_outputs.items():
    report += f"## Q{qnum}\n"
    report += f"**1. Original PDF Region:**\n![Q{qnum}](file:///C:/AI/examgrid/public{outs['asset']})\n\n"
    report += f"**2. Stage 3 (OCR Output - Low Confidence Fallback):**\n`{outs['stage3']}`\n\n"
    report += f"**3. Stage 4 (Math Output - High Fidelity LaTeX):**\n`{outs['stage4']}`\n\n"

with open(r'C:\Users\SOURAV\.gemini\antigravity\brain\3d544433-5552-40ec-8232-542f70f2371c\final_fidelity_validation.md', 'w', encoding='utf-8') as f:
    f.write(report)
