import sys, os
# allow imports from ml-engine folder so the `dellmology` package is discoverable
proj_root = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
sys.path.append(proj_root)
import pytest
from dellmology.analysis.screener import AdvancedScreener, ScreenerMode


def test_mode_defaults_and_change():
    s = AdvancedScreener()
    # Default mode from ScreenerConfig is DAYTRADE
    assert s.config.mode == ScreenerMode.DAYTRADE
    s.set_mode(ScreenerMode.SWING)
    assert s.config.mode == ScreenerMode.SWING


def test_scanner_with_mock_data():
    """The screener should return valid StockScore objects when given minimal input."""
    s = AdvancedScreener()
    # provide two symbols with minimal mock structure
    symbols = ['AAA', 'BBB']
    stocks = []
    for sym in symbols:
        stocks.append({
            'symbol': sym,
            'current_price': 1000,
            'atr_percent': 2.0,
            'patterns': [],
            'broker_flows': {},
            'heatmap': {'haka_volume': 0, 'haki_volume': 0, 'total_volume': 0, 'haka_ratio': 0},
            'anomalies': [],
        })
    results = s.screen_all_stocks(stocks)
    assert isinstance(results, list)
    assert all(hasattr(r, 'symbol') for r in results)


def test_api_screen_endpoint():
    """FastAPI endpoint /api/screen should return structured JSON."""
    from fastapi.testclient import TestClient
    # import the main app defined in ml-engine
    from main import app as ml_app

    client = TestClient(ml_app)
    payload = {"mode": "DAYTRADE", "min_score": 0.0}
    response = client.post("/api/screen", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data.get('mode') == 'DAYTRADE'
    assert 'results' in data
    assert 'statistics' in data


