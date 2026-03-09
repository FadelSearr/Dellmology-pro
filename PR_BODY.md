Fix CI: notifier-e2e artifact upload & diagnostics helpers

Summary
- Split listing and upload steps in `.github/workflows/notifier-e2e.yml` to ensure artifacts are created and uploaded early.
- Add diagnostic helpers to gather Actions artifacts and bundle local run diagnostics:
  - `scripts/download_artifacts.py` — download jobs/artifacts/logs using `GITHUB_TOKEN`.
  - `scripts/bundle_diagnostics.py` — bundle `runs/` into `runs/diagnostics_bundle.zip`.
  - `scripts/create_support_issue.sh` — convenience script to create a GH issue with the escalation draft.

Why
- Some historical Actions runs show `completed` but their job lists/logs are unavailable via the API. These changes force at least one early artifact upload and provide local tooling for offline triage and escalation.

Testing
- Local: `python apps/ml-engine/scripts/notifier_e2e.py` produces `apps/ml-engine/logs/`.
- Bundle diagnostics: `python scripts/bundle_diagnostics.py` produces `runs/diagnostics_bundle.zip`.
- Artifact download (requires `GITHUB_TOKEN`): `python scripts/download_artifacts.py` saves to `runs/artifacts/`.

Follow-ups
- If GitHub Support confirms missing job logs cannot be restored for specific runs, attach `runs/diagnostics_bundle.zip` and the `runs/artifacts/<run_id>/` folders to the ticket.
