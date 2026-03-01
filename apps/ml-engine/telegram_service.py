import os
import json
import logging
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import JSONResponse
from typing import Optional, List
from datetime import datetime, timedelta
from telegram_notifier import TelegramNotifier, TelegramAlertManager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Dellmology Telegram Service")

notifier = TelegramNotifier()
alert_manager = TelegramAlertManager(notifier)

# In-memory history (replace with database in production)
alert_history: List[dict] = []
MAX_HISTORY = 100


async def verify_auth(authorization: Optional[str] = Header(None)) -> bool:
    """Verify API key"""
    expected_key = os.getenv('ML_ENGINE_KEY', 'test-key-123')
    if not authorization or authorization != f"Bearer {expected_key}":
        return False
    return True


@app.post("/telegram/alert")
async def send_alert(
    payload: dict,
    authorization: Optional[str] = Header(None)
):
    """Send alert to Telegram"""
    if not await verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        alert_type = payload.get('type')
        symbol = payload.get('symbol')
        data = payload.get('data', {})

        # Route to appropriate handler
        if alert_type == 'trading':
            success = await alert_manager.send_alert_if_cooldown_passed(
                f"{symbol}_trading",
                notifier.send_trading_alert,
                symbol=symbol,
                signal=data.get('signal', 'BUY'),
                price=data.get('price', 0),
                reason=data.get('reason', ''),
                confidence=data.get('confidence', 75)
            )

        elif alert_type == 'market':
            success = await alert_manager.send_alert_if_cooldown_passed(
                f"{symbol}_market",
                notifier.send_market_analysis,
                symbol=symbol,
                regime=data.get('regime', 'NEUTRAL'),
                ups_score=data.get('ups_score', 50),
                whale_activity=data.get('whale_activity', 'None'),
                recommendation=data.get('recommendation', '')
            )

        elif alert_type == 'broker':
            success = await alert_manager.send_alert_if_cooldown_passed(
                f"{symbol}_broker_{data.get('broker_id', '')}",
                notifier.send_broker_alert,
                symbol=symbol,
                broker_id=data.get('broker_id', ''),
                net_value=data.get('net_value', 0),
                z_score=data.get('z_score', 0),
                action=data.get('action', 'TRADING')
            )

        elif alert_type == 'wash_sale':
            success = await alert_manager.send_alert_if_cooldown_passed(
                f"{symbol}_wash_sale",
                notifier.send_wash_sale_alert,
                symbol=symbol,
                wash_sale_score=data.get('wash_sale_score', 0),
                total_volume=data.get('total_volume', 0),
                net_accumulation=data.get('net_accumulation', 0)
            )

        elif alert_type == 'screener':
            success = await notifier.send_screener_results(
                mode=data.get('mode', 'DAYTRADE'),
                stocks=data.get('stocks', []),
                timestamp=data.get('timestamp', datetime.now().isoformat())
            )

        elif alert_type == 'backtest':
            success = await alert_manager.send_alert_if_cooldown_passed(
                f"{symbol}_backtest",
                notifier.send_backtest_report,
                symbol=symbol,
                win_rate=data.get('win_rate', 0),
                total_profit=data.get('total_profit', 0),
                sharpe_ratio=data.get('sharpe_ratio', 0)
            )

        else:
            raise ValueError(f"Unknown alert type: {alert_type}")

        # Add to history
        alert_record = {
            'id': len(alert_history) + 1,
            'type': alert_type,
            'symbol': symbol,
            'success': success,
            'timestamp': datetime.now().isoformat(),
            'data': data
        }
        alert_history.append(alert_record)

        # Keep history size bounded
        if len(alert_history) > MAX_HISTORY:
            alert_history.pop(0)

        return JSONResponse({
            'success': success,
            'alert_id': alert_record['id'],
            'type': alert_type,
            'symbol': symbol,
            'timestamp': alert_record['timestamp']
        })

    except Exception as e:
        logger.error(f"Error sending alert: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- CNN Training & Prediction API ---

@app.post("/cnn/predict")
async def api_cnn_predict(
    payload: dict,
    authorization: Optional[str] = Header(None)
):
    """Generate a CNN prediction for a symbol and store it in DB."""
    if not await verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    symbol = payload.get('symbol')
    use_real = payload.get('real', True)
    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")

    from predict import cnn_predict, connect_to_db
    engine = connect_to_db()
    result = cnn_predict(symbol, engine, use_real_model=use_real)
    return JSONResponse({'success': True, 'result': result})


@app.post("/cnn/train")
async def api_cnn_train(
    payload: dict,
    authorization: Optional[str] = Header(None)
):
    """Trigger model training for a symbol (runs asynchronously)."""
    if not await verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    symbol = payload.get('symbol')
    if not symbol:
        raise HTTPException(status_code=400, detail="symbol is required")

    # Run training in background thread/process
    import threading, subprocess

    def train_job(sym: str):
        try:
            subprocess.run(["python", "train.py", sym], cwd=os.getcwd())
        except Exception as e:
            logger.error(f"Training job failed: {e}")

    threading.Thread(target=train_job, args=(symbol,)).start()
    return JSONResponse({'success': True, 'message': f'Training started for {symbol}'})


@app.get("/telegram/history")
async def get_alert_history(
    symbol: Optional[str] = None,
    limit: int = 10,
    authorization: Optional[str] = Header(None)
):
    """Get alert history"""
    if not await verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    history = alert_history

    if symbol:
        history = [a for a in history if a['symbol'] == symbol]

    return history[-limit:]


@app.get("/telegram/config")
async def get_config(authorization: Optional[str] = Header(None)):
    """Get Telegram configuration status"""
    if not await verify_auth(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")

    return {
        'configured': bool(notifier.bot_token and notifier.chat_id),
        'bot_token_present': bool(notifier.bot_token),
        'chat_id_present': bool(notifier.chat_id),
        'total_alerts_sent': len(alert_history),
        'successful_alerts': sum(1 for a in alert_history if a.get('success', False))
    }


@app.get("/health")
async def health():
    """Health check"""
    return {
        'status': 'ok',
        'service': 'telegram-notifier',
        'timestamp': datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
