from dellmology.intelligence.xai_explainer import explain_prediction


def make_candles(n=5, start=100.0, step=1.0):
    candles = []
    for i in range(n):
        price = start + i * step
        candles.append({"close": price, "open": price - 0.5, "high": price + 0.5, "low": price - 1.0, "volume": 1000 + i * 10})
    return candles


def test_explain_prediction_returns_structure():
    candles = make_candles()
    input_data = {"recent_candles": candles}
    out = explain_prediction({"prediction": "UP", "confidence": 0.7}, input_data)
    assert isinstance(out, dict)
    assert 'feature_importance' in out
    assert 'explanation' in out
    # importance values should sum approximately to 1.0
    fi = out['feature_importance']
    assert abs(sum(fi.values()) - 1.0) < 1e-6
