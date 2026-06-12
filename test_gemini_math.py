import os
import sys
from google import genai

img_path = r"C:\AI\examgrid\public\uploads\cbt_assets\benchmark_inst\job_benchmark_002\regions\stem_2.webp"

import os

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY environment variable is required")

client = genai.Client(api_key=api_key)
prompt = "Transcribe the text and mathematical formulas in this image exactly. Use LaTeX for math."

try:
    with open(img_path, "rb") as f:
        img_bytes = f.read()
        
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=[
            prompt,
            genai.types.Part.from_bytes(data=img_bytes, mime_type="image/webp")
        ]
    )
    print("Gemini Output:")
    print(response.text)
except Exception as e:
    print(f"Error: {e}")
