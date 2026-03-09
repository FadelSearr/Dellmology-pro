Local runbook — finish CI triage and support escalation

Purpose
- Commands to run locally to push the workflow fix branch, download Actions artifacts, create the diagnostics bundle, and open the GitHub Support issue with attachments.

Notes
- Prefer running these in `cmd.exe` or a plain bash shell to avoid PowerShell `PSReadLine` rendering errors seen on this host.
- Requires: `git`, `gh` (GitHub CLI), `python3` (or `python`), and a `GITHUB_TOKEN` with `repo` and `workflow` scopes.

Steps (cmd.exe)

1) Create and push the workflow fix branch

   git checkout -b ci/notifier-e2e-fix
   git add .github/workflows/notifier-e2e.yml
   git add scripts/download_artifacts.py scripts/create_support_issue.sh
   git add SUPPORT_ESCALATION.md
   git commit -m "fix(ci): split listing and upload steps in notifier-e2e workflow and add artifact helpers"
   git push -u origin ci/notifier-e2e-fix

2) Create a PR (non-interactive)

   gh pr create --title "fix(ci): notifier-e2e artifact upload + diagnostics" --body "Split listing/upload steps and add diagnostic helpers." --base main

3) Ensure diagnostics bundle exists

   python scripts/bundle_diagnostics.py

4) Download artifacts and run logs (requires token)

   set GITHUB_TOKEN=<your_token>
   python scripts/download_artifacts.py

5) Create the GitHub Support issue (non-interactive)

   ./scripts/create_support_issue.sh

6) If the issue requires attachments: open the created issue in the browser and attach `runs/diagnostics_bundle.zip` and any `runs/artifacts/<run_id>/` zips.

PowerShell equivalents

  $env:GITHUB_TOKEN = '<your_token>'
  python scripts\bundle_diagnostics.py
  python scripts\download_artifacts.py
  .\scripts\create_support_issue.sh

If anything fails locally, paste the failing command's stdout/stderr here and I'll help triage the error.
