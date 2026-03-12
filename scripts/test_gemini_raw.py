import os
import json
from pathlib import Path
import requests


def load_env(repo_root: Path):
    env_path = repo_root / '.env'
    env = {}
    if env_path.exists():
        with env_path.open('r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' not in line:
                    continue
                k, v = line.split('=', 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def main():
    repo_root = Path(__file__).resolve().parents[1]
    env = load_env(repo_root)
    api_key = env.get('LLM_API_KEY') or os.environ.get('LLM_API_KEY')
    if not api_key:
        print(json.dumps({'ok': False, 'detail': 'no LLM_API_KEY in .env or environment'}))
        return

    model = os.environ.get('LLM_MODEL') or env.get('LLM_MODEL') or 'gemini-1.5'
    url = f'https://generativelanguage.googleapis.com/v1beta2/models/{model}:generate?key={api_key}'
    payload = {'prompt': 'Say hello.', 'maxOutputTokens': 20}
    try:
        resp = requests.post(url, json=payload, timeout=15)
        out = {'status': resp.status_code}
        try:
            out['body'] = resp.json()
        except Exception:
            out['body'] = resp.text
        print(json.dumps(out, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'ok': False, 'detail': str(e)}))


if __name__ == '__main__':
    main()
