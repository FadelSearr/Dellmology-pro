Release: v2.0.0
=================

Summary
-------
This PR prepares the release notes and context for `v2.0.0` which includes:

- RLS hardening and audit improvements
- Maintenance APIs: refresh aggregates, rls-smoke, retrain/eval scheduling
- Admin auth: Bearer token, HS256 JWT and JWKS/RS256 verification
- Model evaluation & promotion orchestration, persistence to `ml_model_evaluations`
- UPS local event logging for evaluation runs
- Frontend: admin Evaluate & Promote UI and proxy routes
- Additional minor fixes and CI/build corrections

Files changed (high level)
--------------------------
- apps/ml-engine/dellmology/api/maintenance_api.py
- apps/ml-engine/dellmology/api/audit_api.py
- apps/ml-engine/dellmology/utils/model_retrain_scheduler.py
- apps/ml-engine/dellmology/models/model_registry.py
- apps/web/src/app/admin/audit/page.tsx

Release checklist
-----------------
- [ ] Confirm CI/E2E on main (compose e2e workflows)
- [ ] Confirm `SUPABASE_*` secrets for production migrations (if applicable)
- [ ] Provide `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to enable notifications
- [ ] Create GitHub Release from tag `v2.0.0` and attach changelog

Notes for reviewers
-------------------
- The tag `v2.0.0` was created earlier; this branch simply carries human-friendly release notes.
- If you prefer, merge to `main` and then create a GitHub Release via the UI or `gh` CLI.

Local commands to push this branch and open PR (run from repo root):

```powershell
git checkout -b release/v2.0.0
git add RELEASE_PR.md
git commit -m "chore(release): prepare release PR for v2.0.0"
git push -u origin release/v2.0.0
# then open PR via UI or: gh pr create --fill
```
