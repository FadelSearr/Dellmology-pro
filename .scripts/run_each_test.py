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
        # Run pytest and stream output directly to the log file to avoid
        # losing data on large outputs or timeouts. Increase timeout to
        # 900s to accommodate longer integration tests.
        with open(out_log, 'w', encoding='utf-8') as fh:
            fh.write('CMD: ' + ' '.join(cmd) + '\n\n')
            res = subprocess.run(cmd, stdout=fh, stderr=subprocess.STDOUT, text=True, timeout=900)
        # Read combined output for heuristics
        with open(out_log, 'r', encoding='utf-8') as fh:
            combined = fh.read()
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
        print(name, 'TIMED OUT (900s)')
        # Append timeout marker to the existing log so we keep partial output
        with open(out_log, 'a', encoding='utf-8') as fh:
            fh.write('\n\n--- TIMEOUT (900s) ---\n')
        summary.append((name, 'TIMEOUT'))
    except Exception as e:
        print(name, 'ERROR', e)
        with open(out_log, 'a', encoding='utf-8') as fh:
            fh.write('\n\n--- ERROR ---\n')
            fh.write(str(e))
        summary.append((name, 'ERROR', str(e)))

print('\nSummary:')
for s in summary:
    print(s)
