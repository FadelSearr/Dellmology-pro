# Load TELEGRAM_* from .env, remove local webhook, and call send_telegram.ps1 to use the real Telegram API
if (Test-Path .env) {
    Get-Content .env | Where-Object { $_ -match '^\s*TELEGRAM_' } | ForEach-Object {
        if ($_ -match '^\s*([^=]+)=(.*)$') {
            $name=$matches[1]; $val=$matches[2].Trim(); Set-Item -Path Env:\$name -Value $val
        }
    }
}
# Force using the real Telegram API
if (Test-Path Env:\TELEGRAM_LOCAL_WEBHOOK) { Remove-Item Env:\TELEGRAM_LOCAL_WEBHOOK }

# Masked debug output
$t = $env:TELEGRAM_BOT_TOKEN
if ($t) { if ($t.Length -gt 8) { $masked = $t.Substring(0,4) + '...' + $t.Substring($t.Length-4) } else { $masked = '****' } } else { $masked = '<unset>' }
Write-Output "TELEGRAM_BOT_TOKEN: $masked"
Write-Output "TELEGRAM_CHAT_ID: $($env:TELEGRAM_CHAT_ID -or '<unset>')"

$d = Get-Date -Format o
$msg = 'Live Telegram API test at ' + $d
Write-Output "Sending: $msg"
& './scripts/send_telegram.ps1' -Message $msg
