import pytest
from dellmology.analysis.screener import ScreenerConfig, run_multi_version_analysis, calculate_model_confidence
from dellmology.utils.db_utils import validate_golden_record, save_signal_snapshot

# Dummy data for tests
STOCKS_DATA = [
    {"symbol": "BBCA", "score": 85, "recommendation": "BUY"},
    {"symbol": "BMRI", "score": 78, "recommendation": "SELL"},
]
ACTUAL_OUTCOMES = {"BBCA": 0.05, "BMRI": -0.03}
ANCHOR_SYMBOLS = ["BBCA", "BMRI"]
PUBLIC_PRICES = {"BBCA": 9000, "BMRI": 7000}


def test_golden_record_validation():
    result = validate_golden_record(ANCHOR_SYMBOLS, PUBLIC_PRICES, threshold=0.02)
    assert isinstance(result, dict)
    assert all(isinstance(v, bool) for v in result.values())


def test_multi_version_analysis():
    config_a = ScreenerConfig()
    config_b = ScreenerConfig(min_technical_score=0.75)
    result = run_multi_version_analysis(STOCKS_DATA, config_a, config_b)
    assert "champion" in result and "challenger" in result and "comparison" in result


def test_model_confidence_scoring():
    result = calculate_model_confidence(STOCKS_DATA, ACTUAL_OUTCOMES)
    assert "confidence" in result and "status" in result


def test_signal_snapshot():
    snap = {"symbol": "BBCA", "recommendation": "BUY"}
    save_signal_snapshot(snap)
    # No assertion, just ensure no error
