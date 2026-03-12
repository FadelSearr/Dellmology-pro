"""Alert dispatcher

Polls `exit_whale_events` for new events and sends Telegram alerts.
Persists last processed event id in a local file under `logs/`.
"""
import os
import logging
from typing import List
from pathlib import Path

from ..utils.db_utils import get_db_connection
from ..telegram.telegram_service import TelegramService
from sqlalchemy import text

logger = logging.getLogger(__name__)


LAST_ID_FILE = Path(__file__).resolve().parents[2] / 'logs' / 'last_exit_whale_id.txt'


def _read_last_id() -> int:
    try:
        if LAST_ID_FILE.exists():
            txt = LAST_ID_FILE.read_text().strip()
            return int(txt) if txt else 0
    except Exception:
        logger.exception('Failed to read last id file')
    return 0


def _write_last_id(val: int):
    try:
        LAST_ID_FILE.parent.mkdir(parents=True, exist_ok=True)
        LAST_ID_FILE.write_text(str(int(val)))
    except Exception:
        logger.exception('Failed to write last id file')


def fetch_new_events(limit: int = 100) -> List[dict]:
    """Prefer selecting unsent rows using `sent_to_telegram` flag when available.
    Falls back to file-based last-id tracking if column does not exist.
    """
    try:
        with get_db_connection() as conn:
            # Check if column exists
            col_exists = False
            try:
                r = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='exit_whale_events' AND column_name='sent_to_telegram' LIMIT 1")).fetchone()
                col_exists = bool(r)
            except Exception:
                col_exists = False

            if col_exists:
                q = text("SELECT id, time, symbol, broker_id, net_value, note FROM exit_whale_events WHERE (sent_to_telegram IS DISTINCT FROM TRUE) ORDER BY id ASC LIMIT :lim")
                rows = conn.execute(q, {'lim': int(limit)}).fetchall()
                return [dict(r._mapping) for r in rows]
            else:
                last = _read_last_id()
                q = text("SELECT id, time, symbol, broker_id, net_value, note FROM exit_whale_events WHERE id > :last ORDER BY id ASC LIMIT :lim")
                rows = conn.execute(q, {'last': int(last), 'lim': int(limit)}).fetchall()
                return [dict(r._mapping) for r in rows]
    except Exception:
        logger.exception('Failed to fetch new exit whale events')
        return []


def send_alerts_for_events(events: List[dict]) -> int:
    if not events:
        return 0
    svc = TelegramService(os.getenv('TELEGRAM_BOT_TOKEN'), os.getenv('TELEGRAM_CHAT_ID'))
    sent = 0
    ids_to_mark = []
    for ev in events:
        try:
            symbol = ev.get('symbol')
            broker = ev.get('broker_id')
            net = ev.get('net_value')
            note = ev.get('note') or ''
            details = f"Broker: {broker}\nNet sell: {net}\n{note}"
            ok = svc.send_alert(symbol, 'EXIT_WHALE', details)
            if ok:
                sent += 1
                ids_to_mark.append(int(ev.get('id') or 0))
        except Exception:
            logger.exception('Failed to send alert for event')

    # Attempt to mark as sent in DB; if that fails, fall back to file marker using max id
    if ids_to_mark:
        try:
            with get_db_connection() as conn:
                # If column exists, update rows
                col = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='exit_whale_events' AND column_name='sent_to_telegram' LIMIT 1")).fetchone()
                if col:
                    conn.execute(text("UPDATE exit_whale_events SET sent_to_telegram = TRUE WHERE id = ANY(:ids)"), {'ids': ids_to_mark})
                    try:
                        conn.commit()
                    except Exception:
                        pass
                else:
                    # fallback to updating last id file
                    max_id = max(ids_to_mark)
                    _write_last_id(max_id)
        except Exception:
            logger.exception('Failed to mark events as sent in DB; falling back to file')
            try:
                max_id = max(ids_to_mark)
                _write_last_id(max_id)
            except Exception:
                pass

    return sent


def run_dispatch_once():
    events = fetch_new_events()
    if not events:
        return 0
    return send_alerts_for_events(events)
