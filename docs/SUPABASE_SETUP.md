# Supabase / TimescaleDB Setup (local checks)

This document describes the minimal environment variables and steps to run the RLS/audit checks and migrations locally for the Dellmology repository.

Required environment variables (example):


Security note: Do NOT use production credentials here. Use a throwaway/test Supabase project or a local Postgres instance (e.g. via docker-compose).

Quick local run (using `DATABASE_URL`):

1. Create a local Postgres/TimescaleDB instance (recommended using the repo's compose files or official images).

2. Export your DB URL in the shell (PowerShell example):

```powershell
$env:DATABASE_URL = "postgresql://user:pass@localhost:5432/dellmology_test"
```

3. Run the RLS checker script:

```powershell
python apps/ml-engine/scripts/check_supabase_rls.py
```

4. To apply RLS skeleton migrations (migration runner will skip when SUPABASE_* vars are unset):

```powershell
python apps/ml-engine/scripts/run_migrations.py
```

CI guidance

  - `SUPABASE_TEST_DATABASE_URL` or `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`


If you need me to wire an optional self-hosted TimescaleDB stack for CI to run a full integration, I can add a docker-compose job and make the workflow run a deterministic DB for tests.
