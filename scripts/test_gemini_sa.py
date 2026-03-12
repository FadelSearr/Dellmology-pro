import os
import json
import sys
from pathlib import Path

try:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    import requests
except Exception as e:
    print(json.dumps({'ok': False, 'detail': 'missing-deps', 'error': str(e)}))
    print('Please install: pip install google-auth requests')
    sys.exit(2)


def main():
    sa_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not sa_path:
        # look for a common location in repo
        candidate = Path(__file__).resolve().parents[1] / 'sa-key.json'
        if candidate.exists():
            sa_path = str(candidate)

    if not sa_path or not Path(sa_path).exists():
        print(json.dumps({'ok': False, 'detail': 'no-service-account-json', 'path': sa_path}))
        return

    try:
        scopes = ['https://www.googleapis.com/auth/cloud-platform']
        creds = service_account.Credentials.from_service_account_file(sa_path, scopes=scopes)
        creds.refresh(Request())
        token = creds.token
        model = os.environ.get('LLM_MODEL') or 'text-bison-001'
        url = f'https://generativelanguage.googleapis.com/v1/models/{model}:generate'
        headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
        body = {'prompt': 'Say hello', 'maxOutputTokens': 20}
        resp = requests.post(url, headers=headers, json=body, timeout=15)
        out = {'status': resp.status_code}
        try:
            out['body'] = resp.json()
        except Exception:
            out['body'] = resp.text
        print(json.dumps(out, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({'ok': False, 'detail': 'exception', 'error': str(e)}))


if __name__ == '__main__':
    main()
