# PowerShell deployment helper for local engine with tunnel
# Usage: Open PowerShell in workspace root and run `.	emplates\deploy_local.ps1` (after editing variables below)

# ---------- configuration (edit before running) ----------
$Env:STOCKBIT_TOKEN = "<your-stockbit-token>"
$Env:SUPABASE_URL = "<your-supabase-url>"
$Env:SUPABASE_ANON_KEY = "<your-supabase-anon-key>"
$Env:GEMINI_API_KEY = "<your-gemini-key>"
$Env:PUBLIC_ENGINE_URL = "" # will be filled after tunnel starts

# optional telegram
$Env:TELEGRAM_BOT_TOKEN = "<your-telegram-token>"
$Env:TELEGRAM_CHAT_ID = "<your-chat-id>"

# Activate python environment
Write-Host "Activating Python virtual environment..."
& .\.venv\Scripts\Activate.ps1

# Start Go engine in background
Write-Host "Starting Go streamer (orderflow + real-time)"
Start-Process -NoNewWindow -FilePath "go" -ArgumentList "run apps/streamer/main.go" -WorkingDirectory "$PWD"

# Optionally start Python ML worker
Write-Host "Starting optional Python ML worker (screener)"
Start-Process -NoNewWindow -FilePath "python" -ArgumentList "apps/ml-engine/main.py" -WorkingDirectory "$PWD"

Write-Host "You can now start a tunnel and set PUBLIC_ENGINE_URL" 
Write-Host "Examples: ngrok http 8001  or  cloudflared tunnel run dellmology" 

# After starting tunnel copy the url and assign PUBILC_ENGINE_URL environment variable

Write-Host "Deployment script complete. Ensure frontend and supabase are configured accordingly."
