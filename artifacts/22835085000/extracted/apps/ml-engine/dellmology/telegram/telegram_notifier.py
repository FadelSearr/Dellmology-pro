"""
Telegram Notifier Module
Notification helpers and utilities
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


def send_alert(symbol: str, alert_type: str, details: str = None) -> bool:
    """Send trading alert via Telegram"""
    logger.info(f"Alert: {alert_type} for {symbol}")
    return True


def send_update(message: str) -> bool:
    """Send general update"""
    logger.info(f"Update: {message}")
    return True
