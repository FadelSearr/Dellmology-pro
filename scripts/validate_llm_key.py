import os
import json
import sys
from pathlib import Path

# Ensure repo root on path for imports
repo_root = Path(__file__).resolve().parents[1]
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root / 'apps' / 'ml-engine'))

# locate .env in repo root
env_path = repo_root / '.env'
if not env_path.exists():
    print(json.dumps({'ok': False, 'detail': f'.env not found at {env_path}'}))
    sys.exit(2)

# simple .env parser
env = {}
with env_path.open('r', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        if '=' not in line:
            continue
        k, v = line.split('=', 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        env[k] = v

api_key = env.get('LLM_API_KEY') or os.environ.get('LLM_API_KEY')
provider = env.get('LLM_PROVIDER') or os.environ.get('LLM_PROVIDER') or 'openai'
model = env.get('LLM_MODEL') or os.environ.get('LLM_MODEL')

if not api_key:
    print(json.dumps({'ok': False, 'detail': 'LLM_API_KEY not found in .env or environment'}))
    sys.exit(2)

try:
    import dellmology.intelligence.llm_backend as lb
except Exception as e:
    print(json.dumps({'ok': False, 'detail': f'failed importing llm_backend: {e}'}))
    sys.exit(2)

res = lb.validate_key(api_key, provider=provider, model=model)
print(json.dumps(res, ensure_ascii=False))
