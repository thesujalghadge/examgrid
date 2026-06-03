import sys
import os
import subprocess
import time

def verify_dependencies():
    required_modules = [
        "cv2", "easyocr", "fitz", "PIL", "numpy", "pix2text", "surya", "google.generativeai", "pydantic", "pytesseract"
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
    
    return True

def run_stage(script_name, args, warn_timeout=None):
    print(f"\n--- Running {script_name} ---", flush=True)
    start = time.time()
    
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    cmd = [sys.executable, "-u", script_path] + args
    
    process = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    
    for line in iter(process.stdout.readline, ''):
        print(line, end='', flush=True)
        
    process.stdout.close()
    return_code = process.wait()
    
    elapsed = time.time() - start
    if warn_timeout and elapsed > warn_timeout:
        print(f"[WARNING] {script_name} exceeded timeout threshold! Took {elapsed:.2f}s (Threshold: {warn_timeout}s)", flush=True)
    
    if return_code != 0:
        error_output = process.stderr.read().strip()
        print(f"\n[PIPELINE FATAL ERROR] Stage Failed: {script_name}", flush=True)
        print(f"[ACTION REQUIRED] Fix the runtime error below before continuing.", flush=True)
        
        missing_dep = ""
        if "ModuleNotFoundError: No module named" in error_output:
            for line in error_output.split('\n'):
                if "ModuleNotFoundError" in line:
                    missing_dep = line.split("'")[1] if "'" in line else line
                    break
        
        if missing_dep:
            print(f"[DEPENDENCY ERROR] Missing dependency: '{missing_dep}' in stage '{script_name}'.", flush=True)
            print("Verify your Python environment matches the Next.js runtime environment.", flush=True)
            print(f"Current Python executable: {sys.executable}", flush=True)
            print(f"Please install it or run: pip install -r scripts/pipeline/requirements.txt", flush=True)
        else:
            print(f"[RUNTIME ERROR] Actionable runtime error in {script_name}:", flush=True)
            print("-" * 50, flush=True)
            print(error_output, flush=True)
            print("-" * 50, flush=True)
            
        sys.exit(1)
        
    print(f"--- Completed {script_name} in {elapsed:.2f}s ---\n", flush=True)

def main():
    if "--verify" in sys.argv:
        verify_dependencies()
        print("[VERIFICATION] All Python dependencies verified successfully.", flush=True)
        sys.exit(0)
        
    verify_dependencies()
    
    max_pages = None
    is_lightweight = False
    positional_args = []
    
    for arg in sys.argv[1:]:
        if arg.startswith("--max-pages="):
            max_pages = arg.split("=")[1]
        elif arg == "--lightweight":
            is_lightweight = True
        else:
            positional_args.append(arg)
            
    if len(positional_args) < 2:
        print("Usage: python orchestrator.py <pdf_path> <job_id> <api_key> [--max-pages=N] [--lightweight]", flush=True)
        sys.exit(1)
        
    pdf_path = positional_args[0]
    job_id = positional_args[1]
    api_key = positional_args[2] if len(positional_args) > 2 else "mock_key"
    
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
