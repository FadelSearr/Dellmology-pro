#!/usr/bin/env bash
set -euo pipefail

# Helper: create a GitHub issue with the escalation draft and ensure diagnostics bundle exists.
# Usage: ./scripts/create_support_issue.sh

REPO="FadelSearr/Dellmology-pro"
ISSUE_TITLE="CI: Missing Actions job logs for several runs (request investigation)"
BODY_FILE="SUPPORT_ESCALATION.md"

if [ ! -f "$BODY_FILE" ]; then
  echo "ERROR: $BODY_FILE not found. Create or update it with the escalation body." >&2
  exit 2
fi

if [ ! -f runs/diagnostics_bundle.zip ]; then
  echo "Creating runs/diagnostics_bundle.zip..."
  python3 scripts/bundle_diagnostics.py || python scripts/bundle_diagnostics.py || true
fi

echo "Creating GitHub issue (non-interactive) in $REPO..."
gh issue create --repo "$REPO" --title "$ISSUE_TITLE" --body-file "$BODY_FILE" || {
  echo "gh issue create failed or returned non-zero. You can run the same command locally." >&2
}

echo "If the issue requires attachments, open the created issue in the browser and attach runs/diagnostics_bundle.zip manually."
