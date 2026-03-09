import os
import json
import subprocess
import sys
import pytest


def run_rls_script():
    script = os.path.join(os.path.dirname(__file__), '..', 'scripts', 'rls_smoke_check.py')
    script = os.path.normpath(script)
    if not os.path.exists(script):
        pytest.skip('rls_smoke_check.py not present')
    proc = subprocess.run([sys.executable, script], capture_output=True, text=True)
    return proc.returncode, proc.stdout, proc.stderr


def test_rls_smoke_outputs_json():
    # If DATABASE_URL not configured, skip (CI supplies DB)
    if not os.getenv('DATABASE_URL'):
        pytest.skip('DATABASE_URL not set')
    rc, out, err = run_rls_script()
    assert rc == 0, f'rls script failed: {err}'
    # Ensure stdout is valid JSON with expected keys
    data = json.loads(out)
    assert 'roles' in data
    assert 'tables' in data
    assert 'policies' in data
