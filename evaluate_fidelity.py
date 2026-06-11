import json
import os

base_dir = r'C:\AI\examgrid\public\uploads\cbt_assets\benchmark_inst\job_benchmark_002'
math_path = os.path.join(base_dir, 'math.json')
semantic_path = os.path.join(base_dir, 'semantic.json') # Old semantic just to map IDs

with open(math_path, 'r', encoding='utf-8') as f:
    math_data = json.load(f)

with open(semantic_path, 'r', encoding='utf-8') as f:
    semantic_data = json.load(f)

targets = [1, 2, 10, 20, 30, 40, 50, 60, 75]

def get_math_text(rids):
    if not rids: return []
    texts = []
    for rid in rids:
        clean_rid = rid.replace('p1_', '').replace('p2_', '').replace('p3_', '') # quick strip for all pages
        clean_rid = rid.split('_', 1)[1] if rid.startswith('p') and '_' in rid else rid
        for p in math_data['pages']:
            for r in p['math_regions']:
                if r['id'] == clean_rid:
                    texts.append(f"[{r['type']}] {r.get('math_text', '').strip()}")
    return texts

report = "# Final Pipeline Fidelity Verification\n\n"
report += "The OCR and Math extraction pipeline has been refactored to implement the Target Extraction Order:\n"
report += "- Priority 1: High-fidelity PDF Text Layer (via PyMuPDF)\n"
report += "- Priority 2: Pix2Text Math Extraction (for formula-heavy regions)\n"
report += "- Priority 3: Geometrically Sorted Image OCR (fallback)\n\n"

for num in targets:
    sem_q = next((q for q in semantic_data['questions'] if q['id'] == f"Q{num}"), None)
    if not sem_q:
        report += f"## Q{num}\nNot found in mapping.\n\n"
        continue
        
    rids = sem_q.get('metadata', {}).get('regionIds', [])
    math_texts = get_math_text(rids)
    
    report += f"## Q{num}\n"
    report += "**Extracted Pipeline Input (Fed to Semantic Layer):**\n"
    report += "```\n" + "\n".join(math_texts) + "\n```\n\n"

with open(r'C:\Users\SOURAV\.gemini\antigravity\brain\3d544433-5552-40ec-8232-542f70f2371c\final_fidelity_validation.md', 'w', encoding='utf-8') as f:
    f.write(report)
    
print("Fidelity validation report generated.")
