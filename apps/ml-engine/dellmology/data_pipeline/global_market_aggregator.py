"""
Global Market Aggregator
Aggregates market data from multiple sources and time periods
"""

import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


def aggregate_market_data(symbols: List[str]) -> Dict:
    """Aggregate market data for multiple symbols"""
    return {'symbols': symbols, 'timestamp': 'now'}

import yfinance

def fetch_anchor_prices(symbols: List[str]) -> Dict[str, float]:
    """
    Fetch last prices for anchor stocks from Yahoo Finance
    Args:
        symbols: List of stock symbols (e.g., ["BBCA.JK", "ASII.JK", "TLKM.JK"])
    Returns:
        Dict mapping symbol to last price
    """
    prices = {}
    for symbol in symbols:
        try:
            ticker = yfinance.Ticker(symbol)
            data = ticker.history(period="1d")
            last_price = float(data["Close"].iloc[-1]) if not data.empty else None
            if last_price:
                prices[symbol] = last_price
        except Exception as e:
            logger.error(f"Failed to fetch price for {symbol}: {e}")
    return prices
