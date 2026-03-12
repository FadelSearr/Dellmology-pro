"""
XAI Explainer Module
Explainable AI for model decisions
"""

import logging
from typing import Dict, List

logger = logging.getLogger(__name__)


def _simple_momentum(candles: List[Dict]) -> float:
    if not candles:
        return 0.0
    try:
        closes = [float(c.get('close') or c.get('price') or 0) for c in candles]
        if len(closes) < 2:
            return 0.0
        return (closes[-1] - closes[0]) / max(abs(closes[0]), 1.0)
    except Exception:
        return 0.0


def _volatility(candles: List[Dict]) -> float:
    if not candles:
        return 0.0
    try:
        closes = [float(c.get('close') or c.get('price') or 0) for c in candles]
        if len(closes) < 2:
            return 0.0
        mean = sum(closes) / len(closes)
        var = sum((x - mean) ** 2 for x in closes) / len(closes)
        return (var ** 0.5) / max(abs(mean), 1.0)
    except Exception:
        return 0.0


def explain_prediction(model_output: Dict, input_data: Dict) -> Dict:
    """Generate a lightweight, deterministic explanation from input features.

    This function provides a pragmatic XAI output when a full model-based
    explainer is not available. It inspects `recent_candles` or simple
    numeric features and returns feature importance scores and a short
    natural-language explanation.
    """
    logger.info("Generating XAI explanation (heuristic)...")

    features = {}
    importance = {}
    explanation_lines = []

    # Support feature payloads commonly produced by the API
    candles = input_data.get('recent_candles') if isinstance(input_data, dict) else None
    if candles:
        mom = _simple_momentum(candles)
        vol = _volatility(candles)
        last_price = float(candles[-1].get('close') or candles[-1].get('price') or 0)
        avg_price = sum(float(c.get('close') or c.get('price') or 0) for c in candles) / len(candles)

        features['momentum'] = mom
        features['volatility'] = vol
        features['last_price'] = last_price
        features['avg_price'] = avg_price

        # Heuristic importance: momentum and volatility dominate
        importance['momentum'] = abs(mom)
        importance['volatility'] = abs(vol)
        importance['last_price'] = min(1.0, abs((last_price - avg_price) / max(1.0, avg_price)))
        importance['avg_price'] = 0.1

        if mom > 0.01:
            explanation_lines.append(f"Momentum positive ({mom:.3f}), short-term uptrend detected.")
        elif mom < -0.01:
            explanation_lines.append(f"Momentum negative ({mom:.3f}), short-term downtrend detected.")
        else:
            explanation_lines.append("Momentum neutral")

        if vol > 0.05:
            explanation_lines.append(f"Volatility elevated ({vol:.3f}), expect wider price swings.")

    # Incorporate any provided numeric features
    for k, v in (input_data or {}).items():
        if k == 'recent_candles':
            continue
        try:
            fv = float(v)
            features[k] = fv
            importance[k] = min(1.0, abs(fv) / (abs(features.get('last_price', 1)) + 1e-6))
        except Exception:
            # non-numeric features ignored
            pass

    # Normalize importance to sum to 1.0
    total = sum(importance.values()) or 1.0
    for k in importance:
        importance[k] = float(importance[k]) / float(total)

    # Compose final explanation
    explanation_text = ' '.join(explanation_lines) or 'No strong signals detected.'

    return {
        'prediction': model_output.get('prediction', None),
        'confidence': model_output.get('confidence', None),
        'feature_importance': importance,
        'features': features,
        'explanation': explanation_text
    }
