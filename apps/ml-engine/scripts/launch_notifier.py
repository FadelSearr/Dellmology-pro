import os
import subprocess
import sys

def main():
    out_dir = os.path.join("runs", "notifier_local")
    os.makedirs(out_dir, exist_ok=True)
    log_path = os.path.join(out_dir, "notifier_local.log")

    with open(log_path, "w", encoding="utf-8") as f:
        proc = subprocess.run([
            sys.executable,
            "apps/ml-engine/scripts/notifier_e2e.py",
        ], stdout=f, stderr=subprocess.STDOUT)
    print(f"Exit:{proc.returncode}")

if __name__ == "__main__":
    main()
