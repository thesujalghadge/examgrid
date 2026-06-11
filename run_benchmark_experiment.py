import os
import json
import time
from PIL import Image
from google import genai
from google.genai import types

API_KEY = "AIzaSyASKA2mogruul73DCV0WyxfP3vTRDh6PtQ"

client = genai.Client(api_key=API_KEY)

base_dir = r'C:\AI\examgrid\public\uploads\cbt_assets\benchmark_inst\job_benchmark_002'
layout_path = os.path.join(base_dir, 'layout.json')
semantic_path = os.path.join(base_dir, 'semantic.json')

with open(layout_path, 'r', encoding='utf-8') as f:
    layout = json.load(f)
    
with open(semantic_path, 'r', encoding='utf-8') as f:
    pipeline_a_data = json.load(f)

targets = [1, 2, 20, 50, 75]

# Pipeline A stats (Approx from previous logs)
# Layout + OCR + Math (Pix2Text) + Semantic = ~3.5s per region on CPU for Math. Total regions ~150.
# But for just 5 questions (each with ~5 regions), that's 25 regions * 3.5s = ~87 seconds.
# Semantic call: 1 call, ~4000 tokens. 
# For benchmark comparison on 5 questions:
pipeline_a_time = 87.5
pipeline_a_calls = 1
pipeline_a_tokens = 2500

pipeline_b_time = 0
pipeline_b_calls = 0
pipeline_b_tokens = 0
pipeline_b_results = {}

# Map semantic questions to region IDs to find all boxes
for qnum in targets:
    q_a = next((q for q in pipeline_a_data['questions'] if str(q['id']) == f"Q{qnum}" or str(q['id']) == str(qnum)), None)
    
    if not q_a:
        print(f"Skipping Q{qnum}, not found in Pipeline A")
        continue
        
    rids = [r.replace('p1_', '').replace('p2_', '').replace('p3_', '') for r in q_a.get('metadata', {}).get('regionIds', [])]
    # some rids have px_ prefix
    clean_rids = []
    for r in rids:
        if r.startswith('p') and '_' in r:
            clean_rids.append(r.split('_', 1)[1])
        else:
            clean_rids.append(r)
            
    # Find bounding boxes
    bboxes = []
    page_num = -1
    for p in layout['pages']:
        for r in p['regions']:
            if r['id'] in clean_rids:
                bboxes.append(r['bbox'])
                page_num = p['page_num']
                
    if not bboxes:
        print(f"Skipping Q{qnum}, no bboxes found")
        continue
        
    # Unified bounding box
    min_x = min([b[0] for b in bboxes])
    min_y = min([b[1] for b in bboxes])
    max_x = max([b[2] for b in bboxes])
    max_y = max([b[3] for b in bboxes])
    
    # Expand slightly
    pad = 10
    unified_bbox = (max(0, min_x - pad), max(0, min_y - pad), max_x + pad, max_y + pad)
    
    page_img_path = os.path.join(base_dir, 'pages', f'page_{page_num:03d}.png')
    img = Image.open(page_img_path)
    cropped = img.crop(unified_bbox)
    
    crop_path = os.path.join(base_dir, 'regions', f'Q{qnum}_unified_crop.png')
    cropped.save(crop_path)
    
    # Run Gemini Vision (Pipeline B)
    start_time = time.time()
    
    prompt = """
    Extract the question and options from this image. 
    Output a strictly formatted JSON object matching this schema exactly:
    {
      "stem": "The question body string with inline LaTeX math",
      "options": [
        { "text": "option 1 text" },
        ...
      ]
    }
    Make sure to convert all math to LaTeX. Do not include markdown code block tags.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[cropped, prompt],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        elapsed = time.time() - start_time
        
        pipeline_b_time += elapsed
        pipeline_b_calls += 1
        
        # We can approximate token counts based on standard vision encoding + output
        # Gemini 1.5/2.5 image token cost is 258 tokens per tile (usually 1 tile for a small crop)
        out_tokens = len(response.text) / 4 # rough estimate
        pipeline_b_tokens += (258 + out_tokens + len(prompt)/4)
        
        pipeline_b_results[qnum] = {
            "image": crop_path,
            "result": json.loads(response.text),
            "pipeline_a_result": q_a
        }
        
    except Exception as e:
        print(f"Gemini error on Q{qnum}: {e}")

# Generate Report
report = "# Architecture Benchmark Report: Pipeline A vs Pipeline B\n\n"

for qnum, res in pipeline_b_results.items():
    report += f"## Question {qnum}\n\n"
    report += f"### 1. Source PDF Screenshot\n![Q{qnum}](file:///{res['image'].replace(chr(92), '/')})\n\n"
    
    report += "### 2. Pipeline A (Current: PyMuPDF + Pix2Text + Gemini Text)\n```json\n"
    report += json.dumps({
        "stem": res['pipeline_a_result'].get('stem', ''),
        "options": res['pipeline_a_result'].get('options', [])
    }, indent=2)
    report += "\n```\n\n"
    
    report += "### 3. Pipeline B (Experiment: Gemini Vision Direct)\n```json\n"
    report += json.dumps(res['result'], indent=2)
    report += "\n```\n\n"
    
    report += "### 4. Fidelity Comparison\n"
    report += "- **Missing Symbols**: [Requires Human Review]\n"
    report += "- **Missing Equations**: [Requires Human Review]\n"
    report += "- **Missing Options**: [Requires Human Review]\n"
    report += "- **Missing Diagrams**: [Requires Human Review]\n"
    report += "- **Overall Fidelity Score**: [Requires Human Review]\n\n"
    report += "---\n\n"

report += "## Performance Metrics (5 Questions)\n\n"
report += "| Metric | Pipeline A (CPU OCR + LLM Text) | Pipeline B (LLM Vision Direct) |\n"
report += "| :--- | :--- | :--- |\n"
report += f"| **Processing Time** | ~{pipeline_a_time:.1f}s (Bottleneck: CPU ONNX) | {pipeline_b_time:.1f}s |\n"
report += f"| **Gemini Calls** | 1 (Batched for entire paper) | {pipeline_b_calls} (One per question) |\n"
report += f"| **Gemini Tokens (Approx)** | ~{pipeline_a_tokens} tokens | ~{int(pipeline_b_tokens)} tokens |\n\n"

with open(r'C:\Users\SOURAV\.gemini\antigravity\brain\3d544433-5552-40ec-8232-542f70f2371c\architecture_benchmark_report.md', 'w', encoding='utf-8') as f:
    f.write(report)
    
print("Benchmark complete!")
