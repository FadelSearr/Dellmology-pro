#!/usr/bin/env python3
"""
Download Actions jobs, artifacts, and run logs for specified run IDs.

Usage:
  GITHUB_TOKEN=<token> python scripts/download_artifacts.py

Saves outputs under `runs/artifacts/<run_id>/`.
"""
import os
import sys
import time
import json
import shutil
from pathlib import Path
from typing import Optional

import requests
from requests.exceptions import RequestException


REPO = os.environ.get('GITHUB_REPO', 'FadelSearr/Dellmology-pro')
# retry/backoff settings
RETRIES = int(os.environ.get('DL_RETRIES', '3'))
BACKOFF = float(os.environ.get('DL_BACKOFF', '1.5'))
RUN_IDS = [
    22830664838,
    22830664766,
    22835429115,
    22835428997,
    22835577808,
    22835577923,
]


def gh_api(path: str, token: str, params: Optional[dict] = None):
    url = f'https://api.github.com{path}'
    hdr = {'Authorization': f'token {token}', 'Accept': 'application/vnd.github.v3+json'}
    last_err = None
    for attempt in range(1, RETRIES + 1):
        try:
            r = requests.get(url, headers=hdr, params=params, stream=True, timeout=30)
            return r
        except RequestException as e:
            last_err = e
            sleep = BACKOFF ** attempt
            print(f'gh_api: attempt {attempt} failed: {e}; backoff {sleep}s')
            time.sleep(sleep)
    raise SystemExit(f'gh_api failed after {RETRIES} attempts: {last_err}')


def save_text(path: Path, text: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8')


def download_url(url: str, dst: Path, token: str):
    hdr = {'Authorization': f'token {token}', 'Accept': 'application/octet-stream'}
    last_err = None
    for attempt in range(1, RETRIES + 1):
        try:
            with requests.get(url, headers=hdr, stream=True, timeout=60, allow_redirects=True) as r:
                status = r.status_code
                if status == 200:
                    dst.parent.mkdir(parents=True, exist_ok=True)
                    with open(dst, 'wb') as f:
                        for chunk in r.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                    return 0, ''
                # if 404 or 204 etc, return code
                body = r.text[:2000]
                return status, body
        except RequestException as e:
            last_err = e
            sleep = BACKOFF ** attempt
            print(f'download_url: attempt {attempt} failed: {e}; backoff {sleep}s')
            time.sleep(sleep)
    return 999, f'failed after {RETRIES} attempts: {last_err}'


def main():
    token = os.environ.get('GITHUB_TOKEN')
    if not token:
        print('ERROR: Set GITHUB_TOKEN in the environment (scopes: repo, workflow).')
        return 2

    out_base = Path('runs') / 'artifacts'
    out_base.mkdir(parents=True, exist_ok=True)

    owner_repo = REPO
    owner, repo = owner_repo.split('/')

    for rid in RUN_IDS:
        print('\n=== Run', rid, '===')
        run_dir = out_base / str(rid)
        run_dir.mkdir(parents=True, exist_ok=True)

        # jobs
        jobs_path = f'/repos/{owner}/{repo}/actions/runs/{rid}/jobs'
        r = gh_api(jobs_path, token)
        try:
            jobs_json = r.json()
        except Exception:
            jobs_json = {'error': f'status={r.status_code}'}
        save_text(run_dir / f'{rid}_jobs.json', json.dumps(jobs_json, indent=2, default=str))
        print('Jobs:', getattr(jobs_json, 'get', lambda k, d=None: 'n/a')('total_count', 'n/a'))

        # artifacts list
        arts_path = f'/repos/{owner}/{repo}/actions/runs/{rid}/artifacts'
        r = gh_api(arts_path, token)
        try:
            arts = r.json()
        except Exception:
            arts = {'error': f'status={r.status_code}'}
        save_text(run_dir / f'{rid}_artifacts_list.json', json.dumps(arts, indent=2, default=str))

        artifacts = arts.get('artifacts') if isinstance(arts, dict) else None
        if artifacts:
            for a in artifacts:
                aid = a.get('id')
                name = a.get('name') or f'artifact-{aid}'
                print('Downloading artifact:', name, 'id=', aid)
                dl_url = f'https://api.github.com/repos/{owner}/{repo}/actions/artifacts/{aid}/zip'
                dst = run_dir / f'artifact_{aid}_{name}.zip'
                code, err = download_url(dl_url, dst, token)
                if code == 0:
                    print('Saved', dst)
                else:
                    print('Failed to download artifact', aid, 'code=', code, 'msg=', err[:200])
        else:
            print('No artifacts listed for run', rid)

        # try run logs
        logs_path = f'https://api.github.com/repos/{owner}/{repo}/actions/runs/{rid}/logs'
        print('Attempting to download run logs...')
        dst_logs = run_dir / f'run_{rid}_logs.zip'
        code, err = download_url(logs_path, dst_logs, token)
        if code == 0:
            print('Saved logs to', dst_logs)
        else:
            print('Run logs not available (status/code):', code)

        time.sleep(1)

    print('\nDone. Check runs/artifacts for results.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
