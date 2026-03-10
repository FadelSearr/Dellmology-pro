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
        # Local webhook (development) - send JSON
        $payload = @{ text = $Message } | ConvertTo-Json -Compress
        Invoke-RestMethod -Method Post -Uri $localWebhook -Body $payload -ContentType 'application/json'
        Write-Output "Sent Telegram webhook message to $localWebhook"
    } else {
        if (-not $chat) {
            Write-Error "TELEGRAM_CHAT_ID is not set; cannot send message to Telegram API."
            exit 1
        }
        # Ensure chat id is a string (Telegram accepts numeric IDs as strings too)
        $chat = [string]$chat

        $apiBase = if ($env:TELEGRAM_API_BASE) { $env:TELEGRAM_API_BASE } else { 'https://api.telegram.org' }
        $url = "$apiBase/bot$token/sendMessage"
        $payload = @{ chat_id = $chat; text = $Message } | ConvertTo-Json -Compress
        try {
            Invoke-RestMethod -Method Post -Uri $url -Body $payload -ContentType 'application/json'
            Write-Output "Sent Telegram message to chat $chat"
        } catch {
            $errMsg = $_.Exception.Message
            if ($_.Exception.Response) {
                try {
                    $respBody = $_.Exception.Response.GetResponseStream() |
                        ForEach-Object { $sr = New-Object System.IO.StreamReader($_); $sr.ReadToEnd() }
                } catch {
                    $respBody = $null
                }
                Write-Error "Failed sending Telegram message: $errMsg; response: $respBody"
            } else {
                Write-Error "Failed sending Telegram message: $errMsg"
            }
            exit 1
        }
    }
} catch {
    Write-Error "Failed sending Telegram message: $_"
    exit 1
}
