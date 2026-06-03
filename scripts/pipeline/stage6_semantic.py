import sys
import os
import json
from google import genai
from google.genai import types

def generate_semantic_package(layout_data, ocr_data, math_data, client):
    # Merge OCR and Math text based on layout regions
    regions_by_page = {}
    for page in layout_data["pages"]:
        regions_by_page[page["page_num"]] = {r["id"]: r for r in page["regions"]}
        
    for page in ocr_data["pages"]:
        for ocr in page["ocr"]:
            if ocr["region_id"] in regions_by_page.get(page["page_num"], {}):
                regions_by_page[page["page_num"]][ocr["region_id"]]["text"] = ocr["text"]
                
    for page in math_data["pages"]:
        for math in page["math"]:
            if math["region_id"] in regions_by_page.get(page["page_num"], {}):
                regions_by_page[page["page_num"]][math["region_id"]]["math_text"] = math["math_text"]
                
    # Create the prompt payload
    prompt_payload = json.dumps(regions_by_page, indent=2)
    
    prompt = """
    You are a highly precise semantic normalizer for NTA JEE exam papers.
    You will receive a JSON payload containing segmented regions from the OCR pipeline.
    Each region has an ID, type, text, and math_text.
    
    Your job is to normalize this raw structured OCR output into a clean, semantic JSON package representing the test questions.
    
    Return a JSON object with a 'questions' array.
    Each question MUST have:
    - id: the question number (e.g., '1', '25')
    - type: 'mcq' or 'numerical'
    - subject: 'Physics', 'Chemistry', 'Mathematics', or 'Unknown'
    - stemText: the full combined text of the question
    - options: list of option strings (for MCQ)
    - answer: correct option ID if indicated (e.g. 'A', '1'), else null
    - stemAssetId: the region ID representing the main stem
    - optionAssetIds: list of region IDs representing the options
    - confidence: 0 to 1
    
    DO NOT guess missing information. Just structure what is provided.
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, prompt_payload],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Error calling Gemini: {e}", file=sys.stderr)
        return {"questions": []}

def main():
    if len(sys.argv) < 3:
        print("Usage: python stage6_semantic.py <job_id> <api_key>", file=sys.stderr)
        sys.exit(1)
        
    job_id = sys.argv[1]
    api_key = sys.argv[2]
    
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    
    try:
        with open(os.path.join(base_dir, "layout.json"), "r") as f:
            layout_data = json.load(f)
        with open(os.path.join(base_dir, "ocr.json"), "r") as f:
            ocr_data = json.load(f)
        with open(os.path.join(base_dir, "math.json"), "r") as f:
            math_data = json.load(f)
    except FileNotFoundError as e:
        print(f"Error loading intermediate artifacts: {e}", file=sys.stderr)
        sys.exit(1)
        
    client = genai.Client(api_key=api_key)
    
    print("Normalizing semantics with Gemini...")
    final_package = generate_semantic_package(layout_data, ocr_data, math_data, client)
    
    semantic_path = os.path.join(base_dir, "semantic.json")
    with open(semantic_path, "w", encoding="utf-8") as f:
        json.dump(final_package, f, indent=2)
        
    print(f"Semantic normalization complete. Saved to {semantic_path}")

if __name__ == "__main__":
    main()
