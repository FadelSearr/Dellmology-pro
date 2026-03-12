from fastapi import APIRouter, Request, HTTPException
import os
import logging
from typing import Dict, Any

from ..telegram.telegram_service import TelegramService

router = APIRouter(prefix="/api/telegram", tags=["telegram"])

logger = logging.getLogger(__name__)


def _is_admin(request: Request) -> bool:
    token = request.headers.get('x-admin-token') or request.headers.get('authorization')
    if token and token.lower().startswith('bearer '):
        token = token.split(' ', 1)[1].strip()
    env_admin = os.getenv('ADMIN_TOKEN') or os.getenv('ML_ENGINE_KEY')
    return bool(token and env_admin and token == env_admin)


@router.post('/alert')
async def send_alert(request: Request, body: Dict[str, Any]):
    """Send a Telegram alert. Requires admin token in header `x-admin-token` or `Authorization: Bearer <token>`."""
    if not _is_admin(request):
        raise HTTPException(status_code=401, detail='Unauthorized')

    symbol = str(body.get('symbol', '')).upper()
    alert_type = str(body.get('alert_type', 'ALERT'))
    details = str(body.get('details', ''))

    svc = TelegramService(os.getenv('TELEGRAM_BOT_TOKEN'), os.getenv('TELEGRAM_CHAT_ID'))
    ok = svc.send_alert(symbol, alert_type, details)
    if not ok:
        raise HTTPException(status_code=502, detail='failed_to_send')
    return {'sent': True, 'symbol': symbol}


@router.get('/history')
async def history(limit: int = 200):
    """Return recent notifier debug log lines (best-effort)."""
    try:
        debug_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'logs', 'notifier_debug.log'))
        if not os.path.exists(debug_path):
            return {'lines': []}
        with open(debug_path, 'r', encoding='utf-8') as fh:
            lines = fh.read().splitlines()[-limit:]
        return {'lines': lines}
    except Exception as exc:
        logger.exception('Failed to read notifier history')
        raise HTTPException(status_code=500, detail=str(exc))
