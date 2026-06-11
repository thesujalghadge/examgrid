import fitz
import re

doc = fitz.open('public/uploads/cbt_assets/vision_job_a25908bffffe632e/paper.pdf')
all_markers = []
expected_q = 1
for page_num in range(len(doc)):
    page = doc.load_page(page_num)
    text_dict = page.get_text('dict')
    for block in text_dict.get('blocks', []):
        if 'lines' not in block: continue
        for line in block['lines']:
            for span in line['spans']:
                text = span['text'].strip()
                match = re.match(r'^(?:Q(?:ue(?:stion)?)?|Prob(?:lem)?|Item)?\s*\.?\s*0*(\d+)\s*[\.\):-]', text, re.IGNORECASE)
                if match:
                    q_num = int(match.group(1))
                    if q_num >= expected_q and q_num <= expected_q + 5:
                        all_markers.append({'q_num': q_num, 'page_num': page_num, 'y0': span['bbox'][1], 'text': text})
                        expected_q = q_num + 1

for m in all_markers:
    print(f'Q{m["q_num"]}: page {m["page_num"]}, y0={m["y0"]}, text="{m["text"]}"')
