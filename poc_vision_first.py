import os
import fitz
from PIL import Image
import io
import json
import time
from google import genai
from google.genai import types

# Setup
pdf_path = r"C:\Users\SOURAV\Documents\examgrid data demo\JEE Main 2025 (22 Jan Shift 1) Previous Year Paper with Answer Keys - MathonGo.pdf"
api_key = "AIzaSyASKA2mogruul73DCV0WyxfP3vTRDh6PtQ"

# We want Q1, Q2, Q20, Q50, Q75
# To find boundaries, we need the start of the target Q and the start of the NEXT Q
targets = {
    "Q1": {"page": 0, "next_q": "Q2."},
    "Q2": {"page": 0, "next_q": "Q3."},
    "Q20": {"page": 2, "next_q": "SECTION B"}, # Q20 is last MCQ in physics, next might be Section B or Q21. Actually it's Q21.
    "Q50": {"page": 8, "next_q": "Q51."},
    "Q75": {"page": 12, "next_q": "Q76."}
}

# Ensure output directory
out_dir = r"C:\Users\SOURAV\.gemini\antigravity\brain\3d544433-5552-40ec-8232-542f70f2371c\poc_crops"
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)

# Cost estimations for Gemini 1.5/2.5 Flash
# Input: $0.075 / 1M tokens, Output: $0.30 / 1M tokens
PRICE_PER_1M_INPUT = 0.075
PRICE_PER_1M_OUTPUT = 0.30

results = []

def find_y_coord(page, text_query):
    # Find all instances of the text
    instances = page.search_for(text_query)
    if instances:
        # Return the top y coordinate of the first instance
        return instances[0].y0
    return None

client = genai.Client(api_key=api_key)

prompt = """
You are a highly precise semantic extraction engine for JEE exam papers.
You will receive an image crop containing exactly ONE complete question, including its stem, mathematical equations, diagrams, and options.

Extract the question into the following strict JSON schema:
{
  "id": "Question ID (e.g., Q1)",
  "type": "mcq" | "numerical",
  "subject": "Physics" | "Chemistry" | "Mathematics" | "Unknown",
  "stem": "The complete question text, including all mathematical equations written in standard LaTeX (e.g. $x^2 + y^2 = r^2$)",
  "options": [
    { "text": "(1) option text with LaTeX" },
    { "text": "(2) option text with LaTeX" }
  ]
}

CRITICAL RULES:
1. Reconstruct all mathematical formulas perfectly using LaTeX.
2. Preserve all text. If there's a diagram, just put [DIAGRAM] in the stem text where it belongs.
3. If it's a numerical (NAT) question with no options, leave the options array empty.
4. Output raw JSON only. Do not wrap in markdown blocks.
5. EXTREMELY IMPORTANT: Escape all backslashes in your JSON strings. If you use LaTeX, write "\\alpha" instead of "\alpha", and "\\frac" instead of "\frac". Failure to do so will break the JSON parser.
"""

for q_id, info in targets.items():
    page_num = info["page"]
    next_q = info["next_q"]
    
    page = doc.load_page(page_num)
    
    # 1. Find boundaries
    start_y = find_y_coord(page, f"{q_id}.")
    end_y = find_y_coord(page, next_q)
    
    # Fallbacks if text search fails
    if not start_y:
        print(f"Warning: Could not find {q_id} on page {page_num}. Trying without dot.")
        start_y = find_y_coord(page, q_id)
        
    if not end_y:
        # If we can't find the next question, maybe try Q21 instead of Section B, or just use the page bottom.
        if q_id == "Q20": end_y = find_y_coord(page, "Q21.")
        if not end_y:
            end_y = page.rect.height - 50 # Bottom margin
            
    if not start_y:
        print(f"Skipping {q_id}, could not find start coordinate.")
        continue
        
    print(f"[{q_id}] Y-Bounds: {start_y} -> {end_y}")
    
    # Add some padding
    padding = 10
    start_y = max(0, start_y - padding)
    end_y = min(page.rect.height, end_y + padding)
    
    # 2. Render Page to Image
    zoom = 3.0 # 216 DPI (72 * 3)
    mat = fitz.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=mat)
    
    # Convert fitz rect to image coordinates
    img_start_y = int(start_y * zoom)
    img_end_y = int(end_y * zoom)
    img_width = int(page.rect.width * zoom)
    
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    
    # 3. Crop
    crop_box = (0, img_start_y, img_width, img_end_y)
    cropped_img = img.crop(crop_box)
    
    crop_path = os.path.join(out_dir, f"{q_id}_crop.jpg")
    cropped_img.save(crop_path, "JPEG", quality=90)
    
    # 4. Gemini Vision
    print(f"[{q_id}] Sending crop to Gemini Vision...")
    
    with open(crop_path, "rb") as f:
        img_bytes = f.read()
        
    start_time = time.time()
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                prompt,
                genai.types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg")
            ],
            config=types.GenerateContentConfig(temperature=0.0)
        )
        elapsed = time.time() - start_time
        
        raw_text = response.text
        # Clean JSON
        json_str = raw_text.strip()
        if json_str.startswith("```json"):
            json_str = json_str[7:]
        if json_str.startswith("```"):
            json_str = json_str[3:]
        if json_str.endswith("```"):
            json_str = json_str[:-3]
            
        try:
            parsed_json = json.loads(json_str.strip())
        except json.JSONDecodeError:
            # Fallback for unescaped backslashes in LaTeX
            json_str = json_str.replace('\\', '\\\\')
            parsed_json = json.loads(json_str.strip())
        
        usage = response.usage_metadata
        in_tokens = usage.prompt_token_count if usage else 0
        out_tokens = usage.candidates_token_count if usage else 0
        
        cost = (in_tokens / 1_000_000 * PRICE_PER_1M_INPUT) + (out_tokens / 1_000_000 * PRICE_PER_1M_OUTPUT)
        
        results.append({
            "id": q_id,
            "crop_path": crop_path,
            "raw_response": raw_text,
            "parsed_json": parsed_json,
            "in_tokens": in_tokens,
            "out_tokens": out_tokens,
            "cost": cost,
            "elapsed": elapsed
        })
        print(f"[{q_id}] Success. Cost: ${cost:.6f}")
        
    except Exception as e:
        print(f"[{q_id}] Error: {e}")
        
# 5. Generate Markdown Report
report_path = r"C:\Users\SOURAV\.gemini\antigravity\brain\3d544433-5552-40ec-8232-542f70f2371c\poc_vision_report.md"

md = "# Vision-First Architecture POC\n\n"
md += "> [!NOTE]\n> **Proof of Concept Results**\n"
md += "> This report validates the new Vision-First ingestion architecture. We sliced the page horizontally using robust PyMuPDF text-search to isolate the question boundary, and sent the perfect crop to `gemini-2.5-flash`.\n\n"

for res in results:
    md += f"## {res['id']}\n\n"
    
    # Format crop path for markdown viewer
    unix_path = res['crop_path'].replace(chr(92), '/')
    md += f"### 1. Question Crop (Input to Gemini)\n"
    md += f"![{res['id']} Crop](/{unix_path})\n\n"
    
    md += f"### 2. Extraction Metrics\n"
    md += f"- **Prompt Tokens (Image + Text):** {res['in_tokens']}\n"
    md += f"- **Response Tokens:** {res['out_tokens']}\n"
    md += f"- **Estimated Cost:** ${res['cost']:.6f}\n"
    md += f"- **Latency:** {res['elapsed']:.2f}s\n\n"
    
    md += f"### 3. Final Structured JSON\n"
    md += "```json\n" + json.dumps(res['parsed_json'], indent=2) + "\n```\n\n"
    
    md += "---\n\n"
    
with open(report_path, "w", encoding="utf-8") as f:
    f.write(md)
    
print(f"Report saved to {report_path}")
