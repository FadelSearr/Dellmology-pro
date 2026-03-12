import os
import json
from pathlib import Path
from dellmology.intelligence import llm_backend

# Try to read .env in repo root if present (so users who updated .env don't need to export vars)
repo_env = Path(__file__).resolve().parents[2] / '.env'
env_vals = {}
if repo_env.exists():
    with open(repo_env, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                k, v = line.split('=', 1)
                env_vals[k.strip()] = v.strip().strip('"').strip("'")

# Determine provider and API key from in-memory config env or .env file
provider = os.environ.get('LLM_PROVIDER') or env_vals.get('LLM_PROVIDER') or 'openai'
api_key = os.environ.get('LLM_API_KEY') or env_vals.get('LLM_API_KEY') or os.environ.get('GEMINI_API_KEY') or env_vals.get('GEMINI_API_KEY')

print('Using provider:', provider)
print('API key present:', bool(api_key))
if not api_key:
    print('No API key found in environment or .env file.')
    raise SystemExit(2)

res = llm_backend.validate_key(api_key, provider=provider)
print('Validation result:')
print(json.dumps(res, indent=2))
