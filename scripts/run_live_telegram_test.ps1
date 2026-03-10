if (Test-Path .env) {
    Get-Content .env | Where-Object { $_ -match '^\s*TELEGRAM_' } | ForEach-Object {
        if ($_ -match '^\s*([^=]+)=(.*)$') {
            $name=$matches[1]; $val=$matches[2].Trim(); Set-Item -Path Env:\$name -Value $val
        }
    }
}
$d = Get-Date -Format o
$msg = 'Live Telegram test at ' + $d
Write-Output "Sending message: $msg"
& './scripts/send_telegram.ps1' -Message $msg
