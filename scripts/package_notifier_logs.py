#!/usr/bin/env python3
"""
Package local notifier logs into runs/notifier_local.zip using pure Python.
This avoids PowerShell-specific archive commands and should work cross-platform.

Usage:
  python scripts/package_notifier_logs.py
"""
import shutil
from pathlib import Path
import zipfile
import sys


def collect_logs(src_logs: Path, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    # copy any files from apps/ml-engine/logs to runs/notifier_local/artifacts
    artifacts_dir = out_dir / 'artifacts'
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    if src_logs.exists() and src_logs.is_dir():
        for p in src_logs.iterdir():
            if p.is_file():
                shutil.copy2(p, artifacts_dir / p.name)
    return artifacts_dir


def make_zip(src_dir: Path, dst_zip: Path):
    with zipfile.ZipFile(dst_zip, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in src_dir.rglob('*'):
            if p.is_file():
                arc = p.relative_to(src_dir)
                z.write(p, arc)
    return dst_zip


def main():
    base = Path('runs') / 'notifier_local'
    logs_src = Path('apps') / 'ml-engine' / 'logs'
    print('Collecting logs from', logs_src)
    collect_logs(logs_src, base)
    dst = Path('runs') / 'notifier_local.zip'
    print('Creating zip', dst)
    make_zip(base, dst)
    print('Packaged:', dst)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
