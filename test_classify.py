import sys
import os
import fitz
import re

pdf_path = "public/uploads/cbt_assets/vision_job_fbbd93a742ef50f6/paper.pdf"
if not os.path.exists(pdf_path):
    pdf_path = "public/benchmark.pdf"
if not os.path.exists(pdf_path):
    pdf_path = "public/15q.pdf"

print(f"Testing on {pdf_path}")
doc = fitz.open(pdf_path)

expected_q = 1
all_markers = []

for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    text_dict = page.get_text("dict")
    for block in text_dict.get("blocks", []):
        if "lines" not in block: continue
        for line in block["lines"]:
            for span in line["spans"]:
                text = span["text"].strip()
                match = re.match(r'^(?:Q(?:ue(?:stion)?)?|Prob(?:lem)?|Item)?\s*\.?\s*0*(\d+)\s*[\.\):-]', text, re.IGNORECASE)
                if match:
                    q_num = int(match.group(1))
                    if q_num >= expected_q and q_num <= expected_q + 5:
                        all_markers.append({
                            "q_num": q_num,
                            "page_num": page_num,
                            "y0": span["bbox"][1]
                        })
                        expected_q = q_num + 1

all_markers.sort(key=lambda x: (x["page_num"], x["y0"]))

for i, marker in enumerate(all_markers):
    q_num = marker["q_num"]
    if q_num not in [10, 48]:
        continue

    start_page_num = marker["page_num"]
    start_y = marker["y0"]
    if i + 1 < len(all_markers):
        end_page_num = all_markers[i+1]["page_num"]
        end_y = max(0, all_markers[i+1]["y0"] - 10)
    else:
        end_page_num = len(doc) - 1
        end_page = doc.load_page(end_page_num)
        end_y = end_page.rect.height - 50

    q_text = ""
    for p in range(start_page_num, end_page_num + 1):
        page = doc.load_page(p)
        text_dict = page.get_text("dict")
        p_start_y = 0
        p_end_y = page.rect.height
        if p == start_page_num: p_start_y = max(0, start_y - 10)
        if p == end_page_num: p_end_y = end_y
        for block in text_dict.get("blocks", []):
            if "lines" not in block: continue
            for line in block["lines"]:
                for span in line["spans"]:
                    span_y = span["bbox"][1]
                    if span_y >= p_start_y and span_y <= p_end_y:
                        q_text += span["text"] + " "

    print(f"\n--- Q{q_num} Text ---")
    print(q_text)
    
    # Improved classification logic
    def count_options(text, pattern_list):
        count = 0
        for pat in pattern_list:
            if re.search(pat, text, re.IGNORECASE):
                count += 1
        return count
        
    num_opts = count_options(q_text, [
        r'(?:^|\s)\(1\)(?:\s|$)', 
        r'(?:^|\s)\(2\)(?:\s|$)', 
        r'(?:^|\s)\(3\)(?:\s|$)', 
        r'(?:^|\s)\(4\)(?:\s|$)'
    ])
    
    alpha_opts_1 = count_options(q_text, [
        r'(?:^|\s)\(A\)(?:\s|$)', 
        r'(?:^|\s)\(B\)(?:\s|$)', 
        r'(?:^|\s)\(C\)(?:\s|$)', 
        r'(?:^|\s)\(D\)(?:\s|$)'
    ])
    
    alpha_opts_2 = count_options(q_text, [
        r'(?:^|\s)A\)(?:\s|$)', 
        r'(?:^|\s)B\)(?:\s|$)', 
        r'(?:^|\s)C\)(?:\s|$)', 
        r'(?:^|\s)D\)(?:\s|$)'
    ])
    
    is_mcq = (num_opts >= 3) or (alpha_opts_1 >= 3) or (alpha_opts_2 >= 3)
    
    print(f"num_opts: {num_opts}, alpha_opts_1: {alpha_opts_1}, alpha_opts_2: {alpha_opts_2}")
    print("is_mcq:", is_mcq)

