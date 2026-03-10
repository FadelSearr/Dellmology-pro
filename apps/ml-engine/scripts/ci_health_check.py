#!/usr/bin/env python3
"""CI health check helper.

Prints environment diagnostics useful in CI logs: Python, pip, git, docker,
and presence of key files. Exits 0 on success.
"""
import os
import sys
import subprocess
from pathlib import Path


def run(cmd):
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, shell=True, text=True)
        return out.strip()
    except Exception as e:
        return f"ERROR: {e}"


def main():
    print("CI Health Check")
    print("PWD:", os.getcwd())
    print("Python:", run(sys.executable + " --version"))
    print("Pip:", run("pip --version"))
    print("Git:", run("git --version"))
    print("Git HEAD:", run("git rev-parse --short HEAD"))
    print("Docker:", run("docker --version"))
    print("Docker Compose:", run("docker compose version"))

    # Check for key files
    repo_root = Path(__file__).resolve().parents[2]
    files = [
        repo_root / 'apps' / 'ml-engine' / 'requirements.txt',
        repo_root / 'apps' / 'ml-engine' / 'scripts' / 'run_migrations.py',
        repo_root / '.github' / 'workflows' / 'notifier-e2e.yml'
    ]
    for f in files:
        print(f"Exists {f.relative_to(repo_root)}:", f.exists())

    # Print a short sys.path preview
    print('sys.path (first 5):', sys.path[:5])

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
