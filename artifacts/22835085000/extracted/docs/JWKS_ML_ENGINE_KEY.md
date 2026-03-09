# Admin JWKS and ML_ENGINE_KEY — usage guide

This document explains the environment variables added for admin JWT verification and the ML engine proxy key. Keep secrets out of source control and store them in your deployment environment (e.g., GitHub Secrets, Docker secrets).

Environment variables
- `ML_ENGINE_URL` — URL of the ML engine service (default: `http://localhost:8001`).
- `ML_ENGINE_KEY` — shared static key used by the frontend server to authenticate server-side proxy requests to the ML engine. Use only for local/dev or short-lived CI flows. Prefer using JWTs (RS256) in production.
- `ADMIN_TOKEN` — legacy static admin token (kept for backward compatibility).
- `ADMIN_JWT_SECRET` — HS256 secret used in some test setups (optional).
- `ADMIN_JWKS_URL` — URL to the JWKS JSON endpoint exposing public keys used to verify RS256 admin JWTs (e.g., `https://auth.example.com/.well-known/jwks.json`).
- `ADMIN_JWKS_AUDIENCE` — expected `aud` claim in admin tokens (optional, recommended).
- `ADMIN_JWKS_CACHE_TTL` — TTL (seconds) for caching JWKS keys locally (default: `300`).

How the frontend proxies auth
- Routes in the frontend server (Next.js) will forward an incoming `Authorization` header to the ML engine when present. If no incoming header is provided, they fall back to `ML_ENGINE_KEY` as `Authorization: Bearer <ML_ENGINE_KEY>`.

Recommended deployment pattern
- Production: configure an authentication provider that issues RS256 JWTs for admin users. Set `ADMIN_JWKS_URL` and `ADMIN_JWKS_AUDIENCE` in the ML engine service environment. The ML engine will verify incoming `Authorization: Bearer <jwt>` headers against JWKS keys.
- Local/dev: you may keep a locally-set `ML_ENGINE_KEY` for convenience. Do not use the same key in production.

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
- Rotate keys and JWKS-keys regularly. Deploy a JWKS endpoint that supports key rotation without downtime.
- Enforce short token lifetimes and audience (`aud`) checks for admin tokens.
- Avoid embedding `ML_ENGINE_KEY` into client-side code. It should only be used server-to-server (frontend server -> ML engine).

Where to change this in the repo
- Example server proxy routes updated to prefer incoming `Authorization` header: see `apps/web/src/app/api/*/route.ts`.
- ML engine JWKS verification helpers: `apps/ml-engine/dellmology/utils/jwks.py`.
