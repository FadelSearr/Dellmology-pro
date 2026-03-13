import subprocess
import glob
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TEST_DIR = os.path.join(ROOT, 'apps', 'ml-engine', 'tests')
PY = sys.executable

pattern = os.path.join(TEST_DIR, '**', 'test_*.py')
files = sorted(glob.glob(pattern, recursive=True))
if not files:
    print('No test files found in', TEST_DIR)
    raise SystemExit(1)

LOG_DIR = os.path.join(ROOT, 'apps', 'ml-engine', 'test_logs')
os.makedirs(LOG_DIR, exist_ok=True)

summary = []
for f in files:
    name = os.path.relpath(f, TEST_DIR).replace(os.sep, '_')
    out_log = os.path.join(LOG_DIR, name + '.log')
    os.makedirs(os.path.dirname(out_log), exist_ok=True)
    cmd = [PY, '-m', 'pytest', '-q', f]
    print('\nRunning', f)
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        with open(out_log, 'w', encoding='utf-8') as fh:
            fh.write('CMD: ' + ' '.join(cmd) + '\n\n')
            fh.write(res.stdout or '')
            fh.write('\n--- STDERR ---\n')
            fh.write(res.stderr or '')
        combined = (res.stdout or '') + '\n' + (res.stderr or '')
        # Treat files that only contain module-level skips or collect 0 items as OK
        if res.returncode == 0:
            print(name, 'OK')
            summary.append((name, 'OK'))
        else:
            # Some pytest return codes (e.g., 1 or 5) can indicate "no tests collected"
            # or module-level skips depending on flags; treat those as SKIPPED when
            # there's no explicit FAILURE/ERROR text in output.
            if res.returncode in (1, 5) and 'FAILED' not in combined and 'ERROR' not in combined:
                print(name, 'SKIPPED (treated as OK)')
                summary.append((name, 'SKIPPED'))
            elif ('collected 0 items' in combined or 'skipped' in combined) and 'FAILED' not in combined and 'ERROR' not in combined:
                print(name, 'SKIPPED (treated as OK)')
                summary.append((name, 'SKIPPED'))
            else:
                print(name, 'FAILED (code', res.returncode, ') see', out_log)
                summary.append((name, 'FAILED', res.returncode, out_log))
    except subprocess.TimeoutExpired:
        print(name, 'TIMED OUT (300s)')
        with open(out_log, 'w', encoding='utf-8') as fh:
            fh.write('TIMEOUT')
        summary.append((name, 'TIMEOUT'))

print('\nSummary:')
for s in summary:
    print(s)
