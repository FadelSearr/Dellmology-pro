"""
Alert Trigger Engine - Automatically sends Telegram alerts based on market conditions
Monitors: Market regime changes, UPS score threshold, Z-Score spikes, Wash sale detection
"""

import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List
from dataclasses import dataclass
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MarketSnapshot:
    """Current market state for a stock"""
    symbol: str
    price: float
    regime: str
    ups_score: int
    whale_detected: bool
    z_score: float
    wash_sale_score: float
    volume_trend: str
    timestamp: datetime


class AlertTrigger:
    """Determines when to send alerts based on market conditions"""

    def __init__(self, telegram_client):
        self.telegram = telegram_client
        self.last_alerts: Dict[str, datetime] = {}
        self.regime_history: Dict[str, List[str]] = {}  # Track regime changes
        self.alert_cooldown = 300  # 5 minutes

    async def evaluate_snapshot(self, snapshot: MarketSnapshot) -> Optional[Dict]:
        """
        Evaluate market snapshot and return alert if conditions met
        Returns: {'type': str, 'reason': str, 'confidence': int}
        """
        alerts = []

        # 1. UPS Score Threshold (High quality setups)
        if snapshot.ups_score >= 85:
            reason = f"Strong Buy Signal - UPS {snapshot.ups_score}/100"
            confidence = min(100, snapshot.ups_score)
            alerts.append({
                'type': 'STRONG_BUY',
                'reason': reason,
                'confidence': confidence,
                'score': 10
            })

        elif snapshot.ups_score >= 75 and snapshot.regime == 'UPTREND':
            reason = f"Buy Signal in {snapshot.regime} - UPS {snapshot.ups_score}/100"
            alerts.append({
                'type': 'BUY',
                'reason': reason,
                'confidence': 75,
                'score': 7
            })

        # 2. Regime Change (Momentum shift)
        if snapshot.symbol in self.regime_history:
            prev_regime = self.regime_history[snapshot.symbol][-1] if self.regime_history[snapshot.symbol] else None
            
            if prev_regime and prev_regime != snapshot.regime:
                if snapshot.regime == 'UPTREND':
                    alerts.append({
                        'type': 'REGIME_CHANGE_UP',
                        'reason': f'Regime changed: {prev_regime} → {snapshot.regime}',
                        'confidence': 70,
                        'score': 6
                    })
                elif snapshot.regime == 'DOWNTREND':
                    alerts.append({
                        'type': 'REGIME_CHANGE_DOWN',
                        'reason': f'Regime changed: {prev_regime} → {snapshot.regime}',
                        'confidence': 70,
                        'score': 6
                    })

        # Update regime history
        if snapshot.symbol not in self.regime_history:
            self.regime_history[snapshot.symbol] = []
        self.regime_history[snapshot.symbol].append(snapshot.regime)
        if len(self.regime_history[snapshot.symbol]) > 20:
            self.regime_history[snapshot.symbol].pop(0)

        # 3. Whale Detection (Z-Score > 2.5 sigma)
        if snapshot.whale_detected or snapshot.z_score > 2.5:
            alerts.append({
                'type': 'WHALE_ALERT',
                'reason': f'Large accumulation detected (Z-Score: {snapshot.z_score:.2f})',
                'confidence': 80 if snapshot.z_score > 3 else 65,
                'score': 8
            })

        # 4. Wash Sale Detection
        if snapshot.wash_sale_score > 70:
            alerts.append({
                'type': 'WASH_SALE_WARNING',
                'reason': f'Suspicious volume pattern detected ({snapshot.wash_sale_score:.0f}% confidence)',
                'confidence': 60,
                'score': 4
            })

        # 5. Volatility Spike
        if snapshot.regime == 'VOLATILE':
            alerts.append({
                'type': 'VOLATILITY',
                'reason': 'High volatility detected - Use tighter stops',
                'confidence': 50,
                'score': 3
            })

        # 6. Price Action Reversal (Low UPS + Downtrend)
        if snapshot.ups_score < 30 and snapshot.regime == 'DOWNTREND':
            alerts.append({
                'type': 'STRONG_SELL',
                'reason': f'Weak Signal - UPS {snapshot.ups_score}/100 in downtrend',
                'confidence': 65,
                'score': 8
            })

        # Select highest-scoring alert that passed cooldown
        if alerts:
            alerts.sort(key=lambda x: x['score'], reverse=True)
            selected_alert = alerts[0]
            alert_key = f"{snapshot.symbol}_{selected_alert['type']}"

            # Check cooldown
            if self._check_cooldown(alert_key):
                self.last_alerts[alert_key] = datetime.now()
                return {
                    **selected_alert,
                    'symbol': snapshot.symbol,
                    'price': snapshot.price,
                }

        return None

    def _check_cooldown(self, alert_key: str) -> bool:
        """Check if alert can be sent (respecting cooldown)"""
        if alert_key not in self.last_alerts:
            return True

        time_elapsed = (datetime.now() - self.last_alerts[alert_key]).total_seconds()
        return time_elapsed > self.alert_cooldown


class AlertAggregator:
    """Collects alerts and sends them in batches or individually"""

    def __init__(self, telegram_client):
        self.telegram = telegram_client
        self.pending_alerts: List[Dict] = []
        self.batch_window = 60  # Collect for 60 seconds
        self.last_batch_sent = datetime.now()

    async def add_alert(self, alert: Dict):
        """Add alert to queue"""
        self.pending_alerts.append({
            **alert,
            'timestamp': datetime.now()
        })

        # Send immediately for high-priority alerts
        high_priority = ['STRONG_BUY', 'STRONG_SELL', 'WHALE_ALERT']
        if alert['type'] in high_priority and alert['confidence'] > 75:
            await self.flush()

    async def flush(self):
        """Send all pending alerts"""
        if not self.pending_alerts:
            return

        # Group by symbol
        by_symbol = {}
        for alert in self.pending_alerts:
            symbol = alert['symbol']
            if symbol not in by_symbol:
                by_symbol[symbol] = []
            by_symbol[symbol].append(alert)

        # Send alerts
        for symbol, alerts in by_symbol.items():
            # Send individual high-priority alerts
            for alert in alerts:
                if alert['confidence'] > 75:
                    await self.telegram.send_trading_alert(
                        symbol=symbol,
                        signal=alert['type'],
                        price=alert['price'],
                        reason=alert['reason'],
                        confidence=alert['confidence']
                    )

        self.pending_alerts = []
        self.last_batch_sent = datetime.now()


async def process_market_data(
    symbol: str,
    data: Dict,
    trigger: AlertTrigger,
    aggregator: AlertAggregator
) -> Optional[Dict]:
    """
    Process incoming market data and trigger alerts
    
    Args:
        symbol: Stock symbol
        data: Market data dict with keys: price, regime, ups_score, etc
        trigger: AlertTrigger instance
        aggregator: AlertAggregator instance
    
    Returns:
        Alert payload if triggered
    """
    snapshot = MarketSnapshot(
        symbol=symbol,
        price=data.get('price', 0),
        regime=data.get('regime', 'NEUTRAL'),
        ups_score=data.get('ups_score', 50),
        whale_detected=data.get('whale_detected', False),
        z_score=data.get('z_score', 0),
        wash_sale_score=data.get('wash_sale_score', 0),
        volume_trend=data.get('volume_trend', 'NEUTRAL'),
        timestamp=datetime.now()
    )

    alert = await trigger.evaluate_snapshot(snapshot)

    if alert:
        await aggregator.add_alert(alert)
        return alert

    return None


# Example integration with existing market regime endpoint
async def enhance_market_regime_endpoint(base_data: Dict, trigger: AlertTrigger) -> Dict:
    """
    Called from /api/market-regime endpoint
    Adds alert information to response
    """
    symbol = base_data.get('symbol', 'UNKNOWN')

    # Check if alert should be triggered
    alert = await trigger.evaluate_snapshot(
        MarketSnapshot(
            symbol=symbol,
            price=base_data.get('price', 0),
            regime=base_data.get('regime', 'NEUTRAL'),
            ups_score=base_data.get('ups_score', 50),
            whale_detected=base_data.get('whale_detected', False),
            z_score=base_data.get('z_score', 0),
            wash_sale_score=base_data.get('wash_sale_score', 0),
            volume_trend=base_data.get('volume_trend', 'NEUTRAL'),
            timestamp=datetime.now()
        )
    )

    return {
        **base_data,
        'alert': alert,
        'alert_active': alert is not None
    }


if __name__ == "__main__":
    # Test alert trigger logic
    trigger = AlertTrigger(None)

    test_snapshot = MarketSnapshot(
        symbol='BBCA',
        price=1050.0,
        regime='UPTREND',
        ups_score=85,
        whale_detected=True,
        z_score=2.8,
        wash_sale_score=20.0,
        volume_trend='INCREASING',
        timestamp=datetime.now()
    )

    async def test():
        alert = await trigger.evaluate_snapshot(test_snapshot)
        print(f"Alert triggered: {alert}")

    asyncio.run(test())
