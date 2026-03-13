import os
import time
import threading
import sys
import os

# Ensure ml-engine package is importable
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'apps', 'ml-engine')))
from dellmology.intelligence import llm_backend

# (No in-script env modifications or debug logging by default)

# Helper to print status

def report(prefix):
    st = llm_backend.local_model_status()
    print(f"{prefix} -> status: {st}")
    logging.debug(f"{prefix} -> status: {st}")

# Scenario 1: background preload thread (simulating app startup)
os.environ.pop('LLM_MODEL', None)
print('Scenario 1: No model path set; start background thread to preload')
start = time.time()

def bg():
    ok = llm_backend.preload_local_model(os.getenv('LLM_MODEL'))
    print('Background preload result:', ok)


thr = threading.Thread(target=bg, daemon=True)
thr.start()
# Immediately check status
report('Immediately after starting bg thread')
# Wait a small amount
time.sleep(0.5)
report('After 0.5s')
thr.join(timeout=1)
print('Elapsed', time.time()-start)

# Scenario 2: direct call (foreground)
print('\nScenario 2: Direct foreground preload call')
start = time.time()
ok = llm_backend.preload_local_model(None)
print('Direct preload returned:', ok)
report('After direct call')
print('Elapsed', time.time()-start)
