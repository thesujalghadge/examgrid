import json
import os

path = r'C:\AI\examgrid\public\uploads\cbt_assets\vision_test_job\semantic.json'
with open(path, 'r', encoding='utf-8') as f:
    data = json.load(f)

targets = ['Q1', 'Q2', 'Q20', 'Q50', 'Q75']
found = [q for q in data['questions'] if q['id'] in targets]

for q in found:
    print('='*50)
    print(f"ID: {q['id']}")
    print(f"Crop Path: {q['stemAssetPaths'][0]}")
    print(f"Type: {q['type']}")
    print(f"Options Count: {len(q.get('options', []))}")
    print(f"Answer Mapping: {q.get('answer', 'null')}")
    print('--- RAW JSON ---')
    print(json.dumps(q, indent=2))
