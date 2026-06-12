import sys
import os
import subprocess
import time

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--verify":
        try:
            import fitz
            import PIL
            print("[VERIFICATION] PyMuPDF and Pillow successfully imported.")
            sys.exit(0)
        except ImportError as e:
            print(f"[VERIFICATION ERROR] {e}")
            sys.exit(1)

    if len(sys.argv) < 3:
        print("Usage: python vision_orchestrator.py <pdf_path> <job_id> <api_key>")
        sys.exit(1)
        
    pdf_path = sys.argv[1]
    job_id = sys.argv[2]
    api_key = sys.argv[3] if len(sys.argv) > 3 else "mock_key"
    
    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    os.makedirs(base_dir, exist_ok=True)
    
    print(f"==================================================")
    print(f"VISION-FIRST INGESTION PIPELINE")
    print(f"Job: {job_id}")
    print(f"==================================================")
    
    start_time = time.time()
    
    script_dir = os.path.dirname(__file__)
    
    # STAGE 1: Render & Crop
    print("\n[STAGE 1] Render & Crop Generation")
    s1_cmd = [sys.executable, "-u", os.path.join(script_dir, "vision_stage1_crop.py"), pdf_path, job_id]
    s1_res = subprocess.run(s1_cmd)
    if s1_res.returncode != 0:
        print("[FATAL] Stage 1 failed.")
        sys.exit(1)
        
    elapsed = time.time() - start_time
    print(f"\n==================================================")
    print(f"PIPELINE COMPLETE in {elapsed:.2f}s")
    print(f"Output saved to: {os.path.join(base_dir, 'crops_meta.json')}")
    print(f"==================================================")

if __name__ == "__main__":
    main()
