# Dellmology Telegram Notification Service

Real-time trading alerts delivered to Telegram with intelligent filtering and cooldown management.

## Overview

The Telegram notification system automatically sends alerts when market conditions match your trading criteria:

- **Trading Signals**: UPS score thresholds (Strong Buy @ 85, Buy @ 75, etc)
- **Market Events**: Regime changes, volatility spikes
- **Broker Activity**: Whale detection (Z-Score > 2.5)
- **Risk Alerts**: Wash sale patterns, manipulation detection
- **AI Insights**: Daily screener recommendations, backtest results

## Architecture

```
Market Data Events
        ↓
   Alert Trigger
   (evaluate conditions)
        ↓
   Alert Manager
   (cooldown check)
        ↓
Telegram Service (Python)
   [telegram_service.py]
        ↓
   FastAPI Endpoint
   [/telegram/alert]
        ↓
Telegram Bot API
        ↓
    Your Phone 📱
```

## Files

| File | Purpose |
|------|---------|
| `telegram_notifier.py` | Core Telegram API wrapper, message formatting |
| `telegram_service.py` | FastAPI service, alert endpoint, history tracking |
| `alert_trigger.py` | Intelligent alert generation engine |
| `Dockerfile.telegram` | Docker containerization |
| `requirements.txt` | Python dependencies |

## Installation

### 1. Local Setup

```bash
cd apps/ml-engine
pip install -r requirements.txt
```

### 2. Docker Setup

```bash
docker-compose up -d ml-engine
```

## Configuration

### Environment Variables

```bash
# .env file
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_CHAT_ID=-987654321
ML_ENGINE_KEY=your-api-key
```

### Getting Credentials

1. **Bot Token**:
   - Message `@BotFather` on Telegram
   - `/newbot` → enter name and username
   - Copy the token provided

2. **Chat ID**:
   - For personal: Send `/start` to your bot, visit `api.telegram.org/bot<TOKEN>/getUpdates`
   - For group: Create group, add bot, send message, visit same endpoint
   - Chat ID will appear in response

## Usage

### Standalone Service

```bash
python telegram_service.py
# Runs on http://localhost:8001
```

### Send Alert via API

```bash
curl -X POST http://localhost:8001/telegram/alert \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-api-key" \
  -d '{
    "symbol": "BBCA",
    "signal": "STRONG_BUY",
    "price": 1050.50,
    "reason": "UPS 85 + Whale accumulation",
    "confidence": 85
  }'
```

### Python Integration

```python
from telegram_notifier import TelegramNotifier
import asyncio

notifier = TelegramNotifier()

async def send_alert():
    await notifier.send_trading_alert(
        symbol='BBCA',
        signal='BUY',
        price=1050.0,
        reason='UPS score crossed 75',
        confidence=75
    )

asyncio.run(send_alert())
```

## Alert Types

### Trading Signal Alert
```python
await notifier.send_trading_alert(
    symbol='BBCA',
    signal='STRONG_BUY',      # 'STRONG_BUY', 'BUY', 'SELL', 'STRONG_SELL'
    price=1050.50,
    reason='UPS 85 detected',
    confidence=85             # 0-100
)
```

### Market Analysis Alert
```python
await notifier.send_market_analysis(
    symbol='BBCA',
    regime='UPTREND',         # 'UPTREND', 'DOWNTREND', 'SIDEWAYS', 'VOLATILE'
    ups_score=78,
    whale_activity='Broker PD accumulating 5.2B',
    recommendation='Good entry for swing trade'
)
```

### Broker Alert
```python
await notifier.send_broker_alert(
    symbol='BBCA',
    broker_id='PD',
    net_value=5200000000,
    z_score=3.2,              # Standard deviations
    action='ACCUMULATING'     # or 'DISTRIBUTING'
)
```

### Wash Sale Alert
```python
await notifier.send_wash_sale_alert(
    symbol='BBCA',
    wash_sale_score=75.0,     # 0-100% suspicion
    total_volume=1000000,
    net_accumulation=50000
)
```

### Screener Results
```python
await notifier.send_screener_results(
    mode='DAYTRADE',          # or 'SWING'
    stocks=[
        {'symbol': 'UNVR', 'score': 92, 'reason': 'High HAKA ratio'},
        {'symbol': 'SCMA', 'score': 88, 'reason': 'Whale accumulation'},
    ],
    timestamp='2024-03-01T10:30:00'
)
```

### Backtest Report
```python
await notifier.send_backtest_report(
    symbol='BBCA',
    win_rate=62.5,            # Percentage
    total_profit=1500000,     # In Rupiah
    sharpe_ratio=1.45
)
```

## Alert Triggering

### Automatic (via alert_trigger.py)

```python
from alert_trigger import AlertTrigger, MarketSnapshot

trigger = AlertTrigger(notifier)

snapshot = MarketSnapshot(
    symbol='BBCA',
    price=1050.0,
    regime='UPTREND',
    ups_score=85,
    whale_detected=True,
    z_score=2.8,
    wash_sale_score=15.0,
    volume_trend='INCREASING',
    timestamp=datetime.now()
)

alert = await trigger.evaluate_snapshot(snapshot)
if alert:
    print(f"Alert: {alert['type']} - {alert['reason']}")
```

### Trigger Conditions

| Condition | Alert Type | Confidence |
|-----------|-----------|------------|
| UPS ≥ 85 | STRONG_BUY | min(100, UPS) |
| UPS ≥ 75 & Uptrend | BUY | 75% |
| Regime changes | REGIME_CHANGE | 70% |
| Z-Score > 2.5 | WHALE_ALERT | 65-80% |
| Wash score > 70 | WASH_SALE | 60% |
| UPS < 30 & Downtrend | STRONG_SELL | 65% |

## Cooldown Management

To prevent spam, alerts respect a **5-minute cooldown** per symbol per alert type:

```python
alert_manager = TelegramAlertManager(notifier)
success = await alert_manager.send_alert_if_cooldown_passed(
    alert_key='BBCA_BUY',
    alert_func=notifier.send_trading_alert,
    symbol='BBCA',
    signal='BUY',
    price=1050.0,
    reason='UPS crossed 75',
    confidence=75
)
```

Customize cooldown:
```python
alert_manager.alert_cooldown = 600  # 10 minutes
```

## API Endpoints

### POST /telegram/alert

Send an alert to Telegram.

**Request**:
```json
{
  "type": "trading",
  "symbol": "BBCA",
  "data": {
    "signal": "STRONG_BUY",
    "price": 1050.50,
    "reason": "UPS 85",
    "confidence": 85
  }
}
```

**Response**:
```json
{
  "success": true,
  "alert_id": 42,
  "type": "trading",
  "symbol": "BBCA",
  "timestamp": "2024-03-01T10:30:45.123Z"
}
```

### GET /telegram/history

Fetch alert history.

**Query Parameters**:
- `symbol`: Filter by stock symbol (optional)
- `limit`: Max results (default: 10)

**Response**:
```json
{
  "alerts": [
    {
      "id": 42,
      "type": "trading",
      "symbol": "BBCA",
      "success": true,
      "timestamp": "2024-03-01T10:30:45.123Z",
      "data": {...}
    }
  ],
  "count": 1
}
```

### GET /telegram/config

Check Telegram configuration status.

**Response**:
```json
{
  "configured": true,
  "bot_token_present": true,
  "chat_id_present": true,
  "total_alerts_sent": 42,
  "successful_alerts": 41
}
```

### GET /health

Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "service": "telegram-notifier",
  "timestamp": "2024-03-01T10:30:45.123Z"
}
```

## Integration Examples

### With Next.js API Route

```typescript
// /api/telegram-alert
export async function POST(req: NextRequest) {
  const { type, symbol, data } = await req.json();
  
  const response = await fetch(
    `${process.env.ML_ENGINE_URL}/telegram/alert`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ML_ENGINE_KEY}`,
      },
      body: JSON.stringify({ type, symbol, data }),
    }
  );
  
  return response.json();
}
```

### With Market Regime Endpoint

```go
// In streamer/main.go
alert := map[string]interface{}{
  "type": "trading",
  "symbol": symbol,
  "data": map[string]interface{}{
    "signal": "STRONG_BUY",
    "price": price,
    "reason": "UPS 85+",
    "confidence": 85,
  },
}

// Send to Telegram service
httpClient.Post(
  "http://localhost:8001/telegram/alert",
  "application/json",
  bytes.NewReader(alertJSON),
)
```

## Troubleshooting

### Alerts not sending

1. Check credentials:
   ```bash
   curl -f "https://api.telegram.org/bot<TOKEN>/getMe"
   ```

2. Check service status:
   ```bash
   curl http://localhost:8001/health
   ```

3. Check logs:
   ```bash
   docker logs dellmology-ml-engine
   ```

### Bot not responding

1. Ensure bot is added to chat
2. Verify chat ID is correct (should start with `-` for groups)
3. Test with personal chat first

### Rate limiting

- Telegram allows ~30 messages/second
- Our 5-minute cooldown prevents most issues
- Increase cooldown if getting rate limited

### Authorization errors

- Verify `ML_ENGINE_KEY` environment variable
- Check `Authorization: Bearer <key>` header format

## Production Checklist

- [ ] Telegram bot created and credentials set
- [ ] `.env` file configured with credentials
- [ ] ML engine service deployed and healthy
- [ ] Database connected for alert history
- [ ] Alert types customized per requirements
- [ ] Cooldown periods tuned
- [ ] Alert history database schema created
- [ ] Monitoring/alerting setup for failed alerts
- [ ] Rate limits configured
- [ ] Credentials encrypted in production

## Performance

- Alert evaluation: < 5ms
- Message send: < 500ms
- History queries: < 50ms
- Max alerts/second: 30 (Telegram limit)

## Future Enhancements

- [ ] Database persistence for alert history
- [ ] Multiple channels/chat destinations
- [ ] Rich media (charts, attachments)
- [ ] Alert scheduling (send during market hours only)
- [ ] User preference profiles
- [ ] Alert subscription management
- [ ] Analytics dashboard
