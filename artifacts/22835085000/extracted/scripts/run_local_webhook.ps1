# Starts the local Telegram webhook in the background
$script = Join-Path $PSScriptRoot 'local_telegram_webhook.js'
if (-Not (Test-Path $script)) {
    Write-Error "local_telegram_webhook.js not found in scripts/"
    exit 1
}

# Use Start-Process so PowerShell doesn't block; output shows PID
$node = Get-Command node -ErrorAction SilentlyContinue
if (-Not $node) {
    Write-Error "node is not installed or not on PATH. Install Node.js to run the webhook."
    exit 1
}

$port = $env:WEBHOOK_PORT
if (-Not $port) { $port = 3001 }
Write-Output "Starting local webhook on port $port..."
Start-Process -FilePath node -ArgumentList "$script" -WindowStyle Hidden -NoNewWindow -PassThru | ForEach-Object { Write-Output "Started webhook (PID=$($_.Id))" }
Write-Output "Tip: set TELEGRAM_HEARTBEAT_URL=http://127.0.0.1:$port/api/telegram-alert before starting the streamer to capture alerts."