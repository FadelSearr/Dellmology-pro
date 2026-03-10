# Admin JWKS and ML_ENGINE_KEY — usage guide

This document explains the environment variables added for admin JWT verification and the ML engine proxy key. Keep secrets out of source control and store them in your deployment environment (e.g., GitHub Secrets, Docker secrets).

Environment variables

How the frontend proxies auth

Recommended deployment pattern

Testing examples

1) Call the frontend proxy with an explicit admin JWT (preferred):

```bash
curl -X POST https://your-frontend.example.com/api/models/retrain \
  -H "Authorization: Bearer <ADMIN_JWT_RS256>" \
  -H "Content-Type: application/json" \
  -d '{"model":"my-model"}'
```

2) Call the frontend proxy using the fallback `ML_ENGINE_KEY` (local/dev):

```bash
export ML_ENGINE_KEY=replace-me
curl -X POST http://localhost:3000/api/models/retrain \
  -H "Content-Type: application/json" \
  -d '{"model":"my-model"}'
```

Notes and security recommendations

Where to change this in the repo
