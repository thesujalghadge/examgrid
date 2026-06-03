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
            if not any(target in m for m in available_models):
                print(f"[PIPELINE FATAL ERROR] Target model '{target}' NOT found. Available: {available_models}", flush=True)
                sys.exit(1)
            print(f"[VERIFICATION] Target model '{target}' is available.", flush=True)
        except Exception as e:
            print(f"[VERIFICATION ERROR] Failed to verify models: {e}", flush=True)
            sys.exit(1)
            
    total_start = time.time()
    
    health_report = {
        "job_id": job_id,
        "stages": {},
        "overall_status": "SUCCESS",
        "failures": []
    }
    
    def run_stage_with_guardrails(script_name, args, expected_file=None):
        start_time = time.time()
        start_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(start_time))
        
        print(f"\n{'='*50}", flush=True)
        print(f"[STAGE RUN] {script_name}", flush=True)
        print(f"[STAGE START] {start_iso}", flush=True)
        
        script_path = os.path.join(os.path.dirname(__file__), script_name)
        cmd = [sys.executable, "-u", script_path] + args
        
        # We use subprocess.run with check=False to capture failures deterministically
        result = subprocess.run(cmd)
        
        end_time = time.time()
        end_iso = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(end_time))
        duration = end_time - start_time
        
        stage_info = {
            "start_time": start_iso,
            "end_time": end_iso,
            "duration_s": round(duration, 2),
            "status": "SUCCESS",
            "output_file": expected_file if expected_file and os.path.exists(expected_file) else None
        }
        
        if result.returncode != 0:
            stage_info["status"] = f"FAILED (Exit code {result.returncode})"
            health_report["overall_status"] = "FAILED"
            health_report["failures"].append(f"{script_name} crashed with exit code {result.returncode}.")
            health_report["stages"][script_name] = stage_info
            
            print(f"\n[STAGE FAILED] {script_name} exit code {result.returncode}", flush=True)
            print(f"[STAGE END] {end_iso} | Duration: {duration:.2f}s", flush=True)
            print("[PIPELINE FATAL ERROR] Stage contract violation. Stopping pipeline immediately.", flush=True)
            print_health_report(health_report)
            sys.exit(1)
            
        if expected_file:
            if not os.path.exists(expected_file):
                stage_info["status"] = "FAILED (Missing Output)"
                health_report["overall_status"] = "FAILED"
                health_report["failures"].append(f"{script_name} failed to produce expected output file: {os.path.basename(expected_file)}")
                health_report["stages"][script_name] = stage_info
                print(f"\n[PIPELINE FATAL ERROR] {script_name} output validation failed: {os.path.basename(expected_file)} not found.", flush=True)
                print_health_report(health_report)
                sys.exit(1)
            try:
                import json
                with open(expected_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if not data:
                        raise ValueError("JSON is empty")
            except Exception as e:
                stage_info["status"] = "FAILED (Invalid JSON)"
                health_report["overall_status"] = "FAILED"
                health_report["failures"].append(f"{script_name} produced invalid JSON in {os.path.basename(expected_file)}. Error: {e}")
                health_report["stages"][script_name] = stage_info
                print(f"\n[PIPELINE FATAL ERROR] {script_name} output validation failed: Invalid JSON. {e}", flush=True)
                print_health_report(health_report)
                sys.exit(1)
                
        health_report["stages"][script_name] = stage_info
        print(f"[STAGE SUCCESS] {script_name}", flush=True)
        print(f"[STAGE END] {end_iso} | Duration: {duration:.2f}s", flush=True)
        print(f"{'='*50}\n", flush=True)

    def print_health_report(report):
        print("\n" + "#"*50, flush=True)
        print(" PIPELINE HEALTH REPORT ", flush=True)
        print("#"*50, flush=True)
        print(f"Job ID: {report['job_id']}", flush=True)
        print(f"Overall Status: {report['overall_status']}", flush=True)
        
        print("\n--- Stages ---", flush=True)
        for stage, info in report["stages"].items():
            print(f"[{info['status']}] {stage}", flush=True)
            print(f"  Duration: {info['duration_s']}s", flush=True)
            print(f"  Start: {info['start_time']} | End: {info['end_time']}", flush=True)
            if info['output_file']:
                print(f"  Output: {os.path.basename(info['output_file'])}", flush=True)
                
        if report["failures"]:
            print("\n--- Failures ---", flush=True)
            for f in report["failures"]:
                print(f"  - {f}", flush=True)
        
        print("#"*50 + "\n", flush=True)

    base_dir = os.path.join(os.getcwd(), "public", "uploads", "cbt_assets", job_id)
    
    stage1_args = [pdf_path, job_id]
    if max_pages:
        stage1_args.append(f"--max-pages={max_pages}")

    # Execution Modes
    if "--render-only" in sys.argv:
        run_stage_with_guardrails("stage1_render.py", stage1_args, expected_file=os.path.join(base_dir, "render_meta.json"))
    elif "--layout-only" in sys.argv:
        run_stage_with_guardrails("stage2_layout.py", [pdf_path, job_id, "--no-debug"], expected_file=os.path.join(base_dir, "layout.json"))
    elif "--ocr-only" in sys.argv:
        run_stage_with_guardrails("stage3_ocr.py", [pdf_path, job_id, "--no-debug"], expected_file=os.path.join(base_dir, "ocr.json"))
    elif "--semantic-only" in sys.argv:
        run_stage_with_guardrails("stage6_semantic.py", [job_id, api_key], expected_file=os.path.join(base_dir, "semantic.json"))
    else:
        # Full Pipeline
        run_stage_with_guardrails("stage1_render.py", stage1_args, expected_file=os.path.join(base_dir, "render_meta.json"))
        run_stage_with_guardrails("stage2_layout.py", [pdf_path, job_id, "--no-debug"], expected_file=os.path.join(base_dir, "layout.json"))
        run_stage_with_guardrails("stage3_ocr.py", [pdf_path, job_id, "--no-debug"], expected_file=os.path.join(base_dir, "ocr.json"))
        if not is_lightweight:
            run_stage_with_guardrails("stage4_math.py", [pdf_path, job_id, "--no-debug"], expected_file=os.path.join(base_dir, "math.json"))
        run_stage_with_guardrails("stage6_semantic.py", [job_id, api_key], expected_file=os.path.join(base_dir, "semantic.json"))
    
    print_health_report(health_report)
    print("Pipeline Complete.", flush=True)

if __name__ == "__main__":
    main()
