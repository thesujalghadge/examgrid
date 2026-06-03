import sys
import os
import subprocess
import time

def run_stage(script_name, args):
    print(f"\n--- Running {script_name} ---")
    start = time.time()
    
    script_path = os.path.join(os.path.dirname(__file__), script_name)
    cmd = [sys.executable, script_path] + args
    
    result = subprocess.run(cmd, capture_output=True, text=True)
    
    if result.returncode != 0:
        print(f"Error in {script_name}:\n{result.stderr}")
        sys.exit(1)
        
    print(result.stdout)
    print(f"--- Completed {script_name} in {time.time() - start:.2f}s ---\n")

def main():
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
