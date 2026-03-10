"""
Backtester Module
Historical simulation and strategy validation
"""

import logging
from typing import Dict
import pandas as pd

logger = logging.getLogger(__name__)


def run_backtest(strategy_params: Dict, start_date: str, end_date: str) -> Dict:
    """
    Run historical backtesting
    
    Args:
        strategy_params: Strategy configuration
        start_date: Backtesting start date (YYYY-MM-DD)
        end_date: Backtesting end date (YYYY-MM-DD)
    
    Returns:
        Backtest results with metrics
    """
    logger.info(f"Running backtest from {start_date} to {end_date}...")

    # Example: fetch all symbols, and dead/delisted/suspended ones
    from dellmology.utils.db_utils import fetch_all_symbols
    # For demo, assume fetch_dead_symbols returns list of dead/delisted/suspended symbols
    def fetch_dead_symbols():
        # TODO: Replace with real DB query for delisted/suspended/notasi khusus
        # Example: SELECT symbol FROM emiten_status WHERE status IN ('delisted','suspended','notasi khusus')
        return ["DEAD1", "DEAD2", "SUSP1"]

    all_symbols = fetch_all_symbols()
    dead_symbols = fetch_dead_symbols()

    # Simulate backtest: if buy signal for dead stock, count as 100% loss
    trades = []
    for symbol in all_symbols:
        # Simulate a buy signal for each symbol
        trade = {
            'symbol': symbol,
            'buy_signal': True,
            'is_dead': symbol in dead_symbols,
            'profit': -1.0 if symbol in dead_symbols else 0.1  # -100% loss for dead, +10% for others
        }
        trades.append(trade)

    total_trades = len(trades)
    dead_losses = sum(1 for t in trades if t['is_dead'])
    win_trades = sum(1 for t in trades if t['profit'] > 0)
    total_return = sum(t['profit'] for t in trades)
    win_rate = win_trades / total_trades if total_trades else 0.0
    max_drawdown = min(t['profit'] for t in trades) if trades else 0.0
    sharpe_ratio = (total_return / total_trades) if total_trades else 0.0

    return {
        'total_return': total_return,
        'win_rate': win_rate,
        'max_drawdown': max_drawdown,
        'sharpe_ratio': sharpe_ratio,
        'dead_stock_losses': dead_losses,
        'trades': trades
    }
