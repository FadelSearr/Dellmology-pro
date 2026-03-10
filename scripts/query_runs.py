import os
import subprocess
import json

RUN_IDS = [
    22830664838,
    22830664766,
    22835429115,
    22835428997,
    22835577808,
    22835577923,
]

out_dir = os.path.join('runs', 'artifacts')
os.makedirs(out_dir, exist_ok=True)

def run_cmd(cmd):
    print('RUN:', cmd)
    proc = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return proc.returncode, proc.stdout, proc.stderr

for rid in RUN_IDS:
    jobs_cmd = f'gh api repos/:owner/:repo/actions/runs/{rid}/jobs'
    code, out, err = run_cmd(jobs_cmd)
    path = os.path.join(out_dir, f'{rid}_jobs.json')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(out or '')
        if err:
            f.write('\n\n# STDERR\n')
            f.write(err)
    print(rid, '->', path, 'code=', code)

    # attempt to download any artifacts
    dl_dir = os.path.join(out_dir, str(rid))
    os.makedirs(dl_dir, exist_ok=True)
    dl_cmd = f'gh run download {rid} --dir {dl_dir} --repo :owner/:repo || true'
    code, out, err = run_cmd(dl_cmd)
    with open(os.path.join(dl_dir, 'download.log'), 'w', encoding='utf-8') as f:
        f.write(out or '')
        if err:
            f.write('\n\n# STDERR\n')
            f.write(err)
    print('downloaded for', rid, '->', dl_dir)
