import sys
import os
import json
import time

def generate_semantic_package(ocr_data, math_data, client):
    # Merge OCR and Math text into a unified payload for Gemini
    merged_regions = {}
    
    for page in ocr_data.get("pages", []):
        for region in page.get("regions", []):
            merged_regions[region["id"]] = {
                "id": region["id"],
                "type": region["type"],
                "text": region["text"],
                "assetPath": region["assetPath"]
            }
            
    for page in math_data.get("pages", []):
        for region in page.get("math_regions", []):
            if region["id"] in merged_regions:
                merged_regions[region["id"]]["math_text"] = region["math_text"]
                
    prompt_payload = json.dumps(list(merged_regions.values()), indent=2)
    
    prompt = """
    You are a highly precise semantic normalizer for NTA JEE exam papers.
    You will receive a JSON array containing raw segmented regions from our OCR/Math pipeline.
    Each region has an ID, type (QuestionStem, Option, Image), raw text, and math_text (LaTeX).
    
    CRITICAL RULES:
    1. NEVER rewrite or creatively solve equations. Use the provided 'math_text' exactly as the source of truth if it exists, otherwise fallback to 'text'.
    2. Do NOT hallucinate missing content. If an option is missing, leave it out.
    3. Group stems and their options together into single questions based on context.
    4. Maintain strict deterministic traceability: you MUST include the exact assetPaths of the regions that make up the question.
    
    Return a strict JSON object with a 'questions' array.
    Each question MUST follow this schema exactly:
    {
      "id": "question number or sequential ID",
      "type": "mcq" | "numerical",
      "subject": "Physics" | "Chemistry" | "Mathematics" | "Unknown",
      "stem": "The combined text/math string for the question body",
      "options": ["(A) text", "(B) text", ...] (empty if numerical),
      "answer": "null or inferred if answer key is present",
      "confidence": 0.0 to 1.0 (your confidence in this normalization),
      "assetPaths": ["/uploads/...stem.webp", "/uploads/...opt.webp"],
      "metadata": {
        "ambiguityFlags": ["list of any weird formatting issues you noticed, else empty"],
        "regionIds": ["stem_1", "opt_1_1"]
      }
    }
    """
    
    try:
        from google import genai
        from google.genai import types
        
        # If running in mock mode (no API key provided or invalid)
        if not client or client == "mock_key":
            print("[DEBUG] Warning: No valid Gemini API key provided. Generating mock semantic package.", flush=True)
            return mock_semantic_package(list(merged_regions.values()))
            
        print("[DEBUG] Gemini request started...", flush=True)
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, prompt_payload],
            config=types.GenerateContentConfig(response_mime_type="application/json")
        )
        print("[DEBUG] Gemini response received.", flush=True)
        
        print("[DEBUG] Semantic normalization started (parsing JSON)...", flush=True)
        parsed_response = json.loads(response.text)
        print("[DEBUG] Semantic normalization complete.", flush=True)
        
        return parsed_response
    except Exception as e:
        print(f"[PIPELINE FATAL ERROR] Error calling Gemini: {e}", flush=True)
        return {"questions": [], "error": str(e)}

def mock_semantic_package(regions):
    # Generates a dummy payload matching the schema for architecture proofing without consuming quotas
    questions = []
    current_q = None
    
    for r in regions:
        if r["type"] == "QuestionStem":
            if current_q:
                questions.append(current_q)
            current_q = {
                "id": r["id"].replace("stem_", ""),
                "type": "mcq",
                "subject": "Unknown",
                "stem": r.get("math_text", r["text"]),
                "options": [],
                "answer": None,
                "confidence": 0.9,
                "assetPaths": [r["assetPath"]],
                "metadata": {
                    "ambiguityFlags": [],
                    "regionIds": [r["id"]]
                }
            }
        elif r["type"] == "Option" and current_q:
            current_q["options"].append(r.get("math_text", r["text"]))
            current_q["assetPaths"].append(r["assetPath"])
            current_q["metadata"]["regionIds"].append(r["id"])
            
    if current_q:
        questions.append(current_q)
        
    return {"questions": questions}

def main():
    if len(sys.argv) < 3:
        print("Usage: python stage6_semantic.py <job_id> <api_key>", file=sys.stderr)
        sys.exit(1)
        
    job_id = sys.argv[1]
    api_key = sys.argv[2]
    
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    
    try:
        with open(os.path.join(base_dir, "ocr.json"), "r") as f:
            ocr_data = json.load(f)
            
        math_data = {"pages": []}
        math_path = os.path.join(base_dir, "math.json")
        if os.path.exists(math_path):
            with open(math_path, "r") as f:
                math_data = json.load(f)
        else:
            print("Notice: math.json not found, assuming lightweight mode. Math regions will be skipped.", file=sys.stderr)
            
    except FileNotFoundError as e:
        print(f"Error loading intermediate artifacts: {e}", file=sys.stderr)
        sys.exit(1)
        
    client = "mock_key"
    if api_key != "mock_key":
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
        except ImportError:
            print("Warning: google-genai not installed. Falling back to mock.", file=sys.stderr)
            
    start_time = time.time()
    final_package = generate_semantic_package(ocr_data, math_data, client)
    elapsed = time.time() - start_time
    
    print(f"Semantic normalization generated {len(final_package.get('questions', []))} questions in {elapsed:.2f}s", flush=True)
    
    if "error" in final_package and not final_package.get("questions"):
        print(f"[PIPELINE FATAL ERROR] Semantic generation failed due to API error: {final_package['error']}", flush=True)
        sys.exit(1)
        
    semantic_path = os.path.join(base_dir, "semantic.json")
    print(f"[DEBUG] semantic.json write started to {semantic_path}...", flush=True)
    with open(semantic_path, "w", encoding="utf-8") as f:
        json.dump(final_package, f, indent=2)
        
    print(f"[DEBUG] semantic.json write completed.", flush=True)
    print(f"Semantic normalization complete. Saved to {semantic_path}", flush=True)

if __name__ == "__main__":
    main()
