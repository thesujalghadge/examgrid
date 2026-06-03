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
    
    if len(sys.argv) < 3:
        print("Usage: python orchestrator.py <pdf_path> <job_id> <api_key>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    job_id = sys.argv[2]
    api_key = sys.argv[3] if len(sys.argv) > 3 else "mock_key"
    
    run_stage("stage1_render.py", [pdf_path, job_id])
    run_stage("stage2_layout.py", [pdf_path, job_id])
    run_stage("stage3_ocr.py", [pdf_path, job_id])
    run_stage("stage4_math.py", [pdf_path, job_id])
    run_stage("stage6_semantic.py", [job_id, api_key])
    
    print("Pipeline Complete. Final package is ready at semantic.json.")

if __name__ == "__main__":
    main()
