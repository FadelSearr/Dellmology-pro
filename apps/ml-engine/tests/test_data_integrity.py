from dellmology.data_integrity import detect_gap, is_price_outlier, validate_tick
from datetime import datetime, timedelta


def test_detect_gap_true():
    a = datetime.utcnow()
    b = a + timedelta(seconds=10)
    assert detect_gap(a, b, threshold_seconds=5) is True


def test_detect_gap_false():
    a = datetime.utcnow()
    b = a + timedelta(seconds=2)
    assert detect_gap(a, b, threshold_seconds=5) is False


def test_is_price_outlier():
    assert is_price_outlier(100.0, 140.0, pct_threshold=0.25) is True
    assert is_price_outlier(100.0, 120.0, pct_threshold=0.25) is False


def test_validate_tick():
    now = datetime.utcnow()
    good = {"timestamp": now.isoformat(), "price": 100.0, "volume": 10}
    assert validate_tick(good) is True
    bad_price = {"timestamp": now.isoformat(), "price": -1.0, "volume": 10}
    assert validate_tick(bad_price) is False
