import sys
import os
import subprocess

def main():
    if len(sys.argv) < 3:
        print("Usage: python test_semantic.py <job_id> <api_key>")
        sys.exit(1)
        
    job_id = sys.argv[1]
    api_key = sys.argv[2]
    
    script_path = os.path.join(os.path.dirname(__file__), "stage6_semantic.py")
    cmd = [sys.executable, "-u", script_path, job_id, api_key]
    
    print(f"--- Running Isolated Semantic Test for Job: {job_id} ---", flush=True)
    result = subprocess.run(cmd)
    
    if result.returncode != 0:
        print(f"\n[TEST FAILED] Semantic generation failed with exit code {result.returncode}", flush=True)
        sys.exit(result.returncode)
        
    print(f"\n[TEST COMPLETE] Semantic generation successful.", flush=True)

if __name__ == "__main__":
    main()
