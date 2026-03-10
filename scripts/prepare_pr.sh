#!/usr/bin/env bash
set -euo pipefail

# Prepare git commit and print non-interactive commands to run locally.
# Usage: run from repo root in a non-broken shell (cmd.exe or bash)

BRANCH=ci/notifier-e2e-fix
MSG="fix(ci): notifier-e2e artifact upload + diagnostics helpers"

echo "1) Create and switch to branch:"
echo git checkout -b "$BRANCH"

echo
echo "2) Stage files to commit:"
echo git add .github/workflows/notifier-e2e.yml scripts/download_artifacts.py scripts/create_support_issue.sh scripts/bundle_diagnostics.py PR_BODY.md SUPPORT_ESCALATION.md RUN_LOCALLY.md

echo
echo "3) Commit locally:"
echo git commit -m "$MSG"

echo
echo "4) Push branch and create PR (non-interactive):"
echo git push -u origin "$BRANCH"
echo gh pr create --title "fix(ci): notifier-e2e artifact upload + diagnostics" --body-file PR_BODY.md --base main

echo
echo "Run the above commands in a stable shell (cmd.exe, bash)."
