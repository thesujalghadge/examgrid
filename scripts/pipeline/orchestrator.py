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

def run_stage(script_name, args):
    print(f"\n--- Running {script_name} ---")
    start = time.time()
    
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    cmd = [sys.executable, script_path] + args
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        error_output = result.stderr.strip()
        print(f"\n[PIPELINE FATAL ERROR] Stage Failed: {script_name}")
        print(f"[ACTION REQUIRED] Fix the runtime error below before continuing.")
        
        missing_dep = ""
        if "ModuleNotFoundError: No module named" in error_output:
            for line in error_output.split('\n'):
                if "ModuleNotFoundError" in line:
                    missing_dep = line.split("'")[1] if "'" in line else line
                    break
        
        if missing_dep:
            print(f"[DEPENDENCY ERROR] Missing dependency: '{missing_dep}' in stage '{script_name}'.")
            print("Verify your Python environment matches the Next.js runtime environment.")
            print(f"Current Python executable: {sys.executable}")
            print(f"Please install it or run: pip install -r scripts/pipeline/requirements.txt")
        else:
            print(f"[RUNTIME ERROR] Actionable runtime error in {script_name}:")
            print("-" * 50)
            print(error_output)
            print("-" * 50)
            
        sys.exit(1)
        
    print(result.stdout)
    print(f"--- Completed {script_name} in {time.time() - start:.2f}s ---\n")

def main():
    if "--verify" in sys.argv:
        verify_dependencies()
        print("[VERIFICATION] All Python dependencies verified successfully.")
        sys.exit(0)
        
    verify_dependencies()
    
    max_pages = None
    positional_args = []
    
    for arg in sys.argv[1:]:
        if arg.startswith("--max-pages="):
            max_pages = arg.split("=")[1]
        else:
            positional_args.append(arg)
            
    if len(positional_args) < 2:
        print("Usage: python orchestrator.py <pdf_path> <job_id> <api_key> [--max-pages=N]")
        sys.exit(1)
        
    pdf_path = positional_args[0]
    job_id = positional_args[1]
    api_key = positional_args[2] if len(positional_args) > 2 else "mock_key"
    
    total_start = time.time()
    timings = {}
    
    def run_stage_with_timing(script_name, args):
        start = time.time()
        run_stage(script_name, args)
        timings[script_name] = time.time() - start

    stage1_args = [pdf_path, job_id]
    if max_pages:
        stage1_args.append(f"--max-pages={max_pages}")
        
    run_stage_with_timing("stage1_render.py", stage1_args)
    run_stage_with_timing("stage2_layout.py", [pdf_path, job_id, "--no-debug"])
    run_stage_with_timing("stage3_ocr.py", [pdf_path, job_id, "--no-debug"])
    run_stage_with_timing("stage4_math.py", [pdf_path, job_id, "--no-debug"])
    run_stage_with_timing("stage6_semantic.py", [job_id, api_key])
    
    print("\n" + "="*50)
    print("[PIPELINE TIMING SUMMARY]")
    for stage, t in timings.items():
        print(f"  {stage}: {t:.2f}s")
    print(f"  TOTAL: {time.time() - total_start:.2f}s")
    print("="*50 + "\n")
    
    print("Pipeline Complete. Final package is ready at semantic.json.")

if __name__ == "__main__":
    main()
