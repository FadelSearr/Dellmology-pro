from fastapi import APIRouter, Request, HTTPException
import logging
from typing import List, Dict, Any

import importlib
from ..utils.db_utils import get_db_connection
from sqlalchemy import text
import os

router = APIRouter(prefix="/api/exit-whale", tags=["exit-whale"])
logger = logging.getLogger(__name__)


def _is_admin(request: Request) -> bool:
    token = request.headers.get('x-admin-token') or request.headers.get('authorization')
    if token and token.lower().startswith('bearer '):
        token = token.split(' ', 1)[1].strip()
    env_admin = os.getenv('ADMIN_TOKEN') or os.getenv('ML_ENGINE_KEY')
    return bool(token and env_admin and token == env_admin)


@router.post('/run')
async def run_detection(request: Request):
    if not _is_admin(request):
        raise HTTPException(status_code=401, detail='Unauthorized')
    try:
        exit_whale = importlib.import_module('dellmology.exit_whale')
        conn = exit_whale.get_db_conn()
        events = exit_whale.detect_exit_whales(conn)
        conn.close()
        return {'detected': len(events), 'events': events}
    except Exception as exc:
        logger.exception('Exit whale run failed')
        raise HTTPException(status_code=500, detail=str(exc))


@router.get('/recent')
async def recent(limit: int = 50):
    try:
        with get_db_connection() as conn:
            q = text("SELECT symbol, broker_id, net_value, created_at FROM exit_whale_events ORDER BY created_at DESC LIMIT :lim")
            rows = conn.execute(q, {'lim': int(limit)}).fetchall()
            return {'events': [dict(r._mapping) for r in rows]}
    except Exception as exc:
        logger.exception('Failed to fetch recent exit whale events')
        raise HTTPException(status_code=500, detail=str(exc))
