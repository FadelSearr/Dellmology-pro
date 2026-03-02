# PowerShell deployment helper for local engine with tunnel
# Usage: Open PowerShell in workspace root and run `.	emplates\deploy_local.ps1` (after editing variables below)

# ---------- configuration (edit before running) ----------
# copy values from .env or your deployment secrets
$Env:STOCKBIT_TOKEN = "<your-stockbit-token>"
$Env:SUPABASE_URL = "<your-supabase-url>"
$Env:SUPABASE_ANON_KEY = "<your-supabase-anon-key>"
$Env:GEMINI_API_KEY = "<your-gemini-key>"
$Env:PUBLIC_ENGINE_URL = "https://your-tunnel-url" # fill after starting tunnel

# optional telegram credentials (for alerts)
$Env:TELEGRAM_BOT_TOKEN = "<your-telegram-token>"
$Env:TELEGRAM_CHAT_ID = "<your-chat-id>"

# Activate python environment
if (Test-Path ".venv\Scripts\Activate.ps1") {
    Write-Host "Activating Python virtual environment..."
    & .\.venv\Scripts\Activate.ps1
} else {
    Write-Host "Creating Python virtual environment and installing dependencies..."
    python -m venv .venv
    & .\.venv\Scripts\Activate.ps1
    pip install -r apps/ml-engine/requirements.txt
}

# Start Go engine in background
Write-Host "Starting Go streamer (orderflow + real-time)"
Start-Process -NoNewWindow -FilePath "go" -ArgumentList "run apps/streamer/main.go" -WorkingDirectory "$PWD"

# Optionally start Python ML worker
Write-Host "Starting optional Python ML worker (screener)"
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "apps/ml-engine/main.py" -WorkingDirectory "$PWD"

Write-Host "You can now start a tunnel and set PUBLIC_ENGINE_URL" 
Write-Host "Examples: ngrok http 8001  or  cloudflared tunnel run dellmology" 

# After starting tunnel copy the url and assign PUBLIC_ENGINE_URL environment variable, or edit .env and re-run script

Write-Host "Deployment script complete. Ensure frontend (npm run dev inside apps/web) and supabase are configured accordingly."
