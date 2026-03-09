param(
    [Parameter(Mandatory=$true)] [string]$Message
)

# Sends a Telegram message using TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID
# These must be provided as environment variables or set in CI secrets.

$token = $env:TELEGRAM_BOT_TOKEN
$chat = $env:TELEGRAM_CHAT_ID
$localWebhook = $env:TELEGRAM_LOCAL_WEBHOOK

if (-not $token -and -not $localWebhook) {
    Write-Error "TELEGRAM_BOT_TOKEN or TELEGRAM_LOCAL_WEBHOOK must be set; not sending message."
    exit 1
}

try {
    if ($localWebhook) {
        # Local webhook (development)
        Invoke-RestMethod -Method Post -Uri $localWebhook -Body @{ text = $Message } -ContentType 'application/json'
        Write-Output "Sent Telegram webhook message to $localWebhook"
    } else {
        $url = "https://api.telegram.org/bot$token/sendMessage"
        $body = @{ chat_id = $chat; text = $Message }
        Invoke-RestMethod -Method Post -Uri $url -Body $body
        Write-Output "Sent Telegram message to chat $chat"
    }
} catch {
    Write-Error "Failed sending Telegram message: $_"
    exit 1
}
