import os
import json
import re

job_dir = r"C:\AI\examgrid\public\uploads\cbt_assets\benchmark_inst\job_benchmark_002"

with open(os.path.join(job_dir, "layout.json"), "r", encoding="utf-8") as f:
    layout = json.load(f)
with open(os.path.join(job_dir, "ocr.json"), "r", encoding="utf-8") as f:
    ocr = json.load(f)
with open(os.path.join(job_dir, "math.json"), "r", encoding="utf-8") as f:
    math_data = json.load(f)
with open(os.path.join(job_dir, "semantic.json"), "r", encoding="utf-8") as f:
    semantic = json.load(f)
    
questions = semantic.get("questions", [])

# Metrics
q_count = len(questions)
option_count = sum(len(q.get("options", [])) for q in questions)
diagram_count = sum(len(q.get("images", [])) for q in questions)
nat_count = sum(1 for q in questions if q.get("type") == "numerical")

# Missing options check
missing_options = [q["id"] for q in questions if q.get("type") in ["mcq", "multi_correct"] and len(q.get("options", [])) != 4]

# Missing diagrams check
# Identify how many layout regions were 'Image' type
layout_images = 0
for p in layout.get("pages", []):
    for r in p.get("regions", []):
        if r["type"] == "Image":
            layout_images += 1
            
# Missing questions
# We expect exactly 75 questions based on the paper. 
# 20 MCQ + 10 NAT per subject (Physics, Chem, Math) -> 90 questions total in the paper?
# Wait, JEE Main has 90 questions total, but students attempt 75. Usually the paper contains 90 questions.
# Let's count them.

print("==================================================")
print("PIPELINE VALIDATION METRICS")
print("==================================================")
print(f"Total Questions Extracted : {q_count}")
print(f"Total Options Extracted   : {option_count} (Avg: {option_count/q_count:.2f} per Q)")
print(f"Total Diagrams in Layout  : {layout_images}")
print(f"Total Diagrams in JSON    : {diagram_count}")
print(f"Total NAT Questions       : {nat_count}")

print(f"\nQuestions with missing options (<4 for MCQ): {missing_options}")

def extract_for_q(qnum):
    qstr = str(qnum)
    q = next((x for x in questions if str(x["id"]) == qstr or str(x["id"]) == f"Q{qstr}"), None)
    if not q:
        print(f"\n--- Question {qnum} NOT FOUND ---")
        return
        
    print(f"\n--- Question {qnum} Semantic Output ---")
    print(f"Type: {q.get('type')}")
    print(f"Stem: {q.get('stem')}")
    if q.get('images'):
        print(f"Images: {q.get('images')}")
    for i, opt in enumerate(q.get('options', [])):
        print(f"Opt {i+1}: {opt.get('text')}")
        
print("\nTarget Validations:")
for num in [1, 2, 20, 50, 75]:
    extract_for_q(num)
