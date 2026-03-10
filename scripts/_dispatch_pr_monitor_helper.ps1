param(
    [string]$Token
)

if (-not $Token) {
    Write-Error "Token param required"
    exit 1
}

$env:GITHUB_TOKEN = $Token

# Dispatch workflow by file path on the specified branch
gh api -X POST /repos/FadelSearr/Dellmology-pro/actions/workflows/pr-monitor.yml/dispatches -f ref="feat/roadmap-core-infra-2026-03-09" -f inputs.pr_number=11
Start-Sleep -Seconds 3
# List recent runs for the workflow
$runs = gh run list --workflow=pr-monitor.yml --limit 5 --json databaseId,conclusion,headBranch,createdAt
$runs | ConvertTo-Json -Depth 5
