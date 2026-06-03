import sys
import os
import subprocess
import time

def verify_dependencies():
    required_modules = [
        "cv2", "easyocr", "fitz", "PIL", "numpy", "pix2text", "surya", "google.genai", "pydantic", "pytesseract"
    ]
    missing = []
    for module in required_modules:
        try:
            __import__(module)
        except ImportError:
            missing.append(module)
            
    if missing:
        print(f"[PIPELINE FATAL ERROR] Missing required Python dependencies: {', '.join(missing)}")
        print("Please run: pip install -r scripts/pipeline/requirements.txt")
        sys.exit(1)
        
    print("[VERIFICATION] Checking Gemini SDK version...", flush=True)
    try:
        import importlib.metadata
        version = importlib.metadata.version("google-genai")
        print(f"[VERIFICATION] Installed Gemini SDK (google-genai) version: {version}", flush=True)
        from google import genai
        print(f"[VERIFICATION] Gemini SDK successfully imported.", flush=True)
    except Exception as e:
        print(f"[VERIFICATION ERROR] Failed to load Gemini SDK: {e}", flush=True)
    
    return True

def run_stage(script_name, args, warn_timeout=None):
    print(f"\n[STAGE START] {script_name}", flush=True)
    start = time.time()
    
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    cmd = [sys.executable, "-u", script_path] + args
    
    result = subprocess.run(cmd)
    
    elapsed = time.time() - start
    
    if result.returncode != 0:
        print(f"\n[STAGE FAILED] {script_name} crashed with exit code {result.returncode}", flush=True)
        print("[PIPELINE FATAL ERROR] Stopping immediately to preserve raw traceback.", flush=True)
        sys.exit(1)
        
    print(f"[STAGE COMPLETE] {script_name} in {elapsed:.2f}s\n", flush=True)

def main():
    if "--verify" in sys.argv:
        verify_dependencies()
        print("[VERIFICATION] All Python dependencies verified successfully.", flush=True)
        sys.exit(0)
        
    verify_dependencies()
    
    max_pages = None
    is_lightweight = False
    is_semantic_only = False
    positional_args = []
    
    for arg in sys.argv[1:]:
        if arg.startswith("--max-pages="):
            max_pages = arg.split("=")[1]
        elif arg == "--lightweight":
            is_lightweight = True
        elif arg == "--semantic-only":
            is_semantic_only = True
        else:
            positional_args.append(arg)
            
    if len(positional_args) < 2:
        print("Usage: python orchestrator.py <pdf_path> <job_id> <api_key> [--max-pages=N] [--lightweight]", flush=True)
        sys.exit(1)
        
    pdf_path = positional_args[0]
    job_id = positional_args[1]
    api_key = positional_args[2] if len(positional_args) > 2 else "mock_key"
    
    if api_key and api_key != "mock_key":
        print("[VERIFICATION] Fetching available models for API Key...", flush=True)
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            available_models = [m.name for m in client.models.list()]
            target = "gemini-2.5-flash"
            if any(target in m for m in available_models):
                print(f"[VERIFICATION] Target model '{target}' is available.", flush=True)
            else:
                print(f"[PIPELINE FATAL ERROR] Target model '{target}' NOT found. Available: {available_models}", flush=True)
                sys.exit(1)
        except Exception as e:
            print(f"[VERIFICATION ERROR] Failed to verify models: {e}", flush=True)
            sys.exit(1)
            
    total_start = time.time()
    timings = {}
    
    def run_stage_with_timing(script_name, args, warn_timeout=None, expected_file=None):
        start = time.time()
        run_stage(script_name, args, warn_timeout)
        
        if expected_file:
            if not os.path.exists(expected_file):
                print(f"\n[PIPELINE FATAL ERROR] Stage Failed: {script_name} failed to produce expected output file: {os.path.basename(expected_file)}", flush=True)
                sys.exit(1)
            try:
                import json
                with open(expected_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if not data:
                        raise ValueError("JSON is empty")
            except Exception as e:
                print(f"\n[PIPELINE FATAL ERROR] Stage Failed: {script_name} produced invalid JSON in {os.path.basename(expected_file)}. Error: {e}", flush=True)
                sys.exit(1)
                
        timings[script_name] = time.time() - start

    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    
    if is_semantic_only:
        run_stage_with_timing("stage6_semantic.py", [job_id, api_key], warn_timeout=20, expected_file=os.path.join(base_dir, "semantic.json"))
    else:
        stage1_args = [pdf_path, job_id]
        if max_pages:
            stage1_args.append(f"--max-pages={max_pages}")
            
        run_stage_with_timing("stage1_render.py", stage1_args, warn_timeout=15, expected_file=os.path.join(base_dir, "render_meta.json"))
        run_stage_with_timing("stage2_layout.py", [pdf_path, job_id, "--no-debug"], warn_timeout=20, expected_file=os.path.join(base_dir, "layout.json"))
        run_stage_with_timing("stage3_ocr.py", [pdf_path, job_id, "--no-debug"], warn_timeout=30, expected_file=os.path.join(base_dir, "ocr.json"))
        
        if not is_lightweight:
            run_stage_with_timing("stage4_math.py", [pdf_path, job_id, "--no-debug"], warn_timeout=30, expected_file=os.path.join(base_dir, "math.json"))
            
        run_stage_with_timing("stage6_semantic.py", [job_id, api_key], warn_timeout=20, expected_file=os.path.join(base_dir, "semantic.json"))
    
    print("\n" + "="*50, flush=True)
    print("[PIPELINE TIMING SUMMARY]", flush=True)
    for stage, t in timings.items():
        print(f"  {stage}: {t:.2f}s", flush=True)
    print(f"  TOTAL: {time.time() - total_start:.2f}s", flush=True)
    print("="*50 + "\n", flush=True)
    
    print("Pipeline Complete. Final package is ready at semantic.json.", flush=True)

if __name__ == "__main__":
    main()
