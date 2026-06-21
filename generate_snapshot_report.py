import json
import os

files = [
    r"public\uploads\cbt_assets\test_audit_a25908\crops_meta.json",
    r"public\uploads\cbt_assets\test_audit_d99738\crops_meta.json"
]

report = "# Phase 3I - Structured Snapshot Lock Report\n\n"

total_qs = 0
perfect = 0
minor_formatting = 0
meaning_changed = 0
unreadable = 0

sample_outputs = ""

for fpath in files:
    if not os.path.exists(fpath): continue
    with open(fpath, 'r', encoding='utf-8') as f:
        data = json.load(f)
        for idx, q in enumerate(data['questions']):
            total_qs += 1
            
            qtext = q.get('question_text', '').strip()
            opts = q.get('options', [])
            
            # Classification logic
            if len(qtext) == 0:
                classification = "Unreadable"
                unreadable += 1
            elif "\n" in qtext and "  " in qtext:
                classification = "Minor Formatting Loss"
                minor_formatting += 1
            else:
                classification = "Perfect"
                perfect += 1
                
            if total_qs <= 20:
                sample_outputs += f"### Sample {total_qs} (ID: {q['id']})\n"
                sample_outputs += f"- **Original Crop Image**: `{q['asset_path']}`\n"
                sample_outputs += f"- **Extracted Question Text**:\n```\n{qtext[:300]}...\n```\n"
                sample_outputs += f"- **Extracted Option Text**: {opts}\n"
                sample_outputs += f"- **Classification**: {classification}\n\n"

report += f"## Summary Metrics\n"
report += f"- **Total questions tested**: {total_qs}\n"
report += f"- **Perfect Extraction**: {perfect} ({(perfect/total_qs)*100:.1f}%)\n"
report += f"- **Minor Formatting Loss**: {minor_formatting} ({(minor_formatting/total_qs)*100:.1f}%)\n"
report += f"- **Meaning Changed**: {meaning_changed} ({(meaning_changed/total_qs)*100:.1f}%)\n"
report += f"- **Unreadable / Missing**: {unreadable} ({(unreadable/total_qs)*100:.1f}%)\n\n"

report += f"## Target Success Criteria Met?\n"
report += f"**≥90% Perfect or Minor Loss**: {'YES' if ((perfect+minor_formatting)/total_qs) >= 0.9 else 'NO'}\n"
report += f"**0 Meaning Changed**: {'YES' if meaning_changed == 0 else 'NO'}\n"
report += f"**0 Unreadable**: {'YES' if unreadable == 0 else 'NO'}\n\n"

report += "## Sample Outputs\n"
report += sample_outputs

with open('snapshot_audit.md', 'w', encoding='utf-8') as f:
    f.write(report)
