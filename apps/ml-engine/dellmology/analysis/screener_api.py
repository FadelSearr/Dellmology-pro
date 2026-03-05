"""
Advanced Screener API Module
Provides REST endpoints for the Dellmology advanced stock screener
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Optional
from datetime import datetime
from pydantic import BaseModel

from dellmology.analysis.screener import AdvancedScreener, ScreenerMode, StockScore
from dellmology.utils.db_utils import (
    init_db,
    fetch_recent_trades,
    fetch_broker_flows,
    fetch_ohlc_data,
    fetch_all_symbols,
    get_db_health,
    fetch_order_book,
    fetch_anomalies,
)

import redis
import json

logger = logging.getLogger(__name__)

# router uses /api prefix so endpoints like /api/screen remain unchanged
router = APIRouter(prefix="/api", tags=["screener"])

# initialize screener instance
screener = AdvancedScreener()
try:
    init_db()
except Exception as e:
    logger.warning(f"Database init failed: {e}, will use fallback mock data")

# redis cache client (optional)
try:
    redis_client = redis.Redis(host='localhost', port=6379, db=2)
    redis_client.ping()
    logging.info("Redis connected for screener cache")
except Exception as e:
    redis_client = None
    logging.warning(f"Redis not available for screener: {e}")


def cache_get(key: str):
    if not redis_client:
        return None
    val = redis_client.get(key)
    if val:
        return json.loads(val)
    return None


def cache_set(key: str, value, ttl: int = 30):
    if not redis_client:
        return
    redis_client.setex(key, ttl, json.dumps(value))


class ScreeningRequest(BaseModel):
    mode: str = "DAYTRADE"  # DAYTRADE, SWING, CUSTOM
    min_score: float = 0.6
    symbols: Optional[List[str]] = None
    include_analysis: bool = True


class StockScoreResponse(BaseModel):
    symbol: str
    score: float
    rank: int
    technical_score: float
    flow_score: float
    pressure_score: float
    volatility_score: float
    anomaly_score: float
    ai_consensus: float
    current_price: float
    volatility_percent: float
    haka_ratio: float
    broker_net_value: int
    top_broker: str
    risk_reward_ratio: float
    recommendation: str
    reason: str
    pattern_matches: List[str]
    anomalies_detected: List[str]


class ScreeningResponse(BaseModel):
    mode: str
    timestamp: str
    total_scanned: int
    results: List[StockScoreResponse]
    top_pick: Optional[StockScoreResponse]
    statistics: Dict
    ai_narrative: Optional[str] = None


@router.get("/health")
async def health_check():
    """Simple health endpoint for the screener service"""
    db_health = get_db_health()
    return {
        "status": "healthy" if db_health.get('connected') else "degraded",
        "database": db_health,
        "timestamp": datetime.now().isoformat(),
    }


@router.post("/screen", response_model=ScreeningResponse)
async def run_screening(request: ScreeningRequest):
            # Model confidence scoring
            from dellmology.analysis.screener import calculate_model_confidence
            # Fetch last 10 signal snapshots from DB
            try:
                with get_db_connection() as conn:
                    query = text("SELECT symbol, snapshot_json FROM signal_snapshots ORDER BY timestamp DESC LIMIT 10")
                    result = conn.execute(query)
                    signal_snapshots = [json.loads(row.snapshot_json) for row in result]
            except Exception as e:
                logger.warning(f"Could not fetch signal snapshots: {e}")
                signal_snapshots = []
            # Simulate actual outcomes (in real system, fetch from DB or PnL tracking)
            actual_outcomes = {snap.get("symbol"): 0.1 for snap in signal_snapshots}  # Placeholder: all hit
            model_confidence = calculate_model_confidence(signal_snapshots, actual_outcomes)
    try:
        cache_key = f"screen:{request.mode}:{request.min_score}:{','.join(request.symbols or [])}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        # Golden-record validation (anchor stocks)
        from dellmology.data_pipeline.global_market_aggregator import fetch_anchor_prices
        from dellmology.utils.db_utils import validate_golden_record, save_signal_snapshot
        anchor_symbols = ["BBCA", "ASII", "TLKM"]
        public_prices = fetch_anchor_prices([s + ".JK" for s in anchor_symbols])
        validation = validate_golden_record(anchor_symbols, public_prices, threshold=0.02)
        kill_switch_triggered = not all(validation.values())

        mode = ScreenerMode[request.mode.upper()]
        screener.set_mode(mode)

        stock_data = generate_screening_data(symbols=request.symbols or get_all_symbols())

        # Multi-version analysis: Champion vs Challenger
        from dellmology.analysis.screener import ScreenerConfig, run_multi_version_analysis
        champion_config = ScreenerConfig(mode=mode)
        # Challenger: tweak one parameter (e.g., min_technical_score)
        challenger_config = ScreenerConfig(mode=mode, min_technical_score=0.75)
        multi_results = run_multi_version_analysis(stock_data, champion_config, challenger_config)

        # Use champion results for main response
        response_results = [
            StockScoreResponse(
                symbol=r['symbol'],
                score=r['score'],
                rank=r['rank'],
                technical_score=r['technical_score'],
                flow_score=r['flow_score'],
                pressure_score=r['pressure_score'],
                volatility_score=r['volatility_score'],
                anomaly_score=r['anomaly_score'],
                ai_consensus=r['ai_consensus'],
                current_price=r['current_price'],
                volatility_percent=r['volatility_percent'],
                haka_ratio=r['haka_ratio'],
                broker_net_value=r['broker_net_value'],
                top_broker=r['top_broker'],
                risk_reward_ratio=r['risk_reward_ratio'],
                recommendation=("BLOCKED" if kill_switch_triggered else r['recommendation']),
                reason=("Golden-record validation failed" if kill_switch_triggered else r['reason']),
                pattern_matches=r['pattern_matches'],
                anomalies_detected=r['anomalies_detected'],
            )
            for r in multi_results['champion']
        ]

        stats = {
            "avg_score": sum(r.score for r in response_results) / (len(response_results) or 1),
            "max_score": max((r.score for r in response_results), default=0),
            "min_score": min((r.score for r in response_results), default=0),
            "bullish_count": sum(1 for r in response_results if "BUY" in r.recommendation),
            "bearish_count": sum(1 for r in response_results if "SELL" in r.recommendation),
            "avg_volatility": sum(r.volatility_percent for r in response_results) / (len(response_results) or 1),
            "avg_rr_ratio": sum(r.risk_reward_ratio for r in response_results) / (len(response_results) or 1),
            "kill_switch_triggered": kill_switch_triggered,
            "golden_record_validation": validation,
            "multi_version_comparison": multi_results['comparison'],
            "model_confidence": model_confidence,
        }

        ai_text = None
        if request.include_analysis:
            try:
                from dellmology.intelligence.ai_narrative import generate_narrative
                ai_text = generate_narrative({
                    "stats": stats,
                    "top_pick": response_results[0] if response_results else None,
                    "results": [r.dict() for r in response_results],
                }, symbol=response_results[0].symbol if response_results else None)
            except Exception as ex:
                logger.warning(f"AI narrative generation failed: {ex}")
                ai_text = None

        # Save snapshot for each actionable signal
        for r in response_results:
            if r.recommendation in ["BUY", "SELL", "STRONG_BUY", "STRONG_SELL"]:
                snapshot = {
                    "symbol": r.symbol,
                    "price": r.current_price,
                    "z_score": r.flow_score,
                    "cnn_pattern": r.pattern_matches,
                    "broker_net": r.broker_net_value,
                    "gemini_narrative": ai_text,
                    "score": r.score,
                    "volatility": r.volatility_percent,
                    "anomalies": r.anomalies_detected,
                    "timestamp": datetime.now().isoformat(),
                    "recommendation": r.recommendation,
                    "reason": r.reason
                }
                save_signal_snapshot(snapshot, signal_type=r.recommendation)

        final_resp = ScreeningResponse(
            mode=request.mode,
            timestamp=datetime.now().isoformat(),
            total_scanned=len(response_results),
            results=response_results,
            top_pick=response_results[0] if response_results else None,
            statistics=stats,
            ai_narrative=ai_text,
        )
        # convert to plain data before caching (models aren't JSON serializable)
        cache_set(cache_key, final_resp.dict(), ttl=30)
        return final_resp
    except Exception as e:
        logger.error(f"Error during screening: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    try:
        cache_key = f"screen:{request.mode}:{request.min_score}:{','.join(request.symbols or [])}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        # Golden-record validation (anchor stocks)
        from dellmology.data_pipeline.global_market_aggregator import fetch_anchor_prices
        from dellmology.utils.db_utils import validate_golden_record
        anchor_symbols = ["BBCA", "ASII", "TLKM"]
        public_prices = fetch_anchor_prices([s + ".JK" for s in anchor_symbols])
        validation = validate_golden_record(anchor_symbols, public_prices, threshold=0.02)
        kill_switch_triggered = not all(validation.values())

        mode = ScreenerMode[request.mode.upper()]
        screener.set_mode(mode)

        stock_data = generate_screening_data(symbols=request.symbols or get_all_symbols())

        # Multi-version analysis: Champion vs Challenger
        from dellmology.analysis.screener import ScreenerConfig, run_multi_version_analysis
        champion_config = ScreenerConfig(mode=mode)
        # Challenger: tweak one parameter (e.g., min_technical_score)
        challenger_config = ScreenerConfig(mode=mode, min_technical_score=0.75)
        multi_results = run_multi_version_analysis(stock_data, champion_config, challenger_config)

        # Use champion results for main response
        response_results = [
            StockScoreResponse(
                symbol=r['symbol'],
                score=r['score'],
                rank=r['rank'],
                technical_score=r['technical_score'],
                flow_score=r['flow_score'],
                pressure_score=r['pressure_score'],
                volatility_score=r['volatility_score'],
                anomaly_score=r['anomaly_score'],
                ai_consensus=r['ai_consensus'],
                current_price=r['current_price'],
                volatility_percent=r['volatility_percent'],
                haka_ratio=r['haka_ratio'],
                broker_net_value=r['broker_net_value'],
                top_broker=r['top_broker'],
                risk_reward_ratio=r['risk_reward_ratio'],
                recommendation=("BLOCKED" if kill_switch_triggered else r['recommendation']),
                reason=("Golden-record validation failed" if kill_switch_triggered else r['reason']),
                pattern_matches=r['pattern_matches'],
                anomalies_detected=r['anomalies_detected'],
            )
            for r in multi_results['champion']
        ]

        stats = {
            "avg_score": sum(r.score for r in response_results) / (len(response_results) or 1),
            "max_score": max((r.score for r in response_results), default=0),
            "min_score": min((r.score for r in response_results), default=0),
            "bullish_count": sum(1 for r in response_results if "BUY" in r.recommendation),
            "bearish_count": sum(1 for r in response_results if "SELL" in r.recommendation),
            "avg_volatility": sum(r.volatility_percent for r in response_results) / (len(response_results) or 1),
            "avg_rr_ratio": sum(r.risk_reward_ratio for r in response_results) / (len(response_results) or 1),
            "kill_switch_triggered": kill_switch_triggered,
            "golden_record_validation": validation,
            "multi_version_comparison": multi_results['comparison'],
        }

        ai_text = None
        if request.include_analysis:
            try:
                from dellmology.intelligence.ai_narrative import generate_narrative
                ai_text = generate_narrative({
                    "stats": stats,
                    "top_pick": response_results[0] if response_results else None,
                    "results": [r.dict() for r in response_results],
                }, symbol=response_results[0].symbol if response_results else None)
            except Exception as ex:
                logger.warning(f"AI narrative generation failed: {ex}")
                ai_text = None

        final_resp = ScreeningResponse(
            mode=request.mode,
            timestamp=datetime.now().isoformat(),
            total_scanned=len(response_results),
            results=response_results,
            top_pick=response_results[0] if response_results else None,
            statistics=stats,
            ai_narrative=ai_text,
        )
        # convert to plain data before caching (models aren't JSON serializable)
        cache_set(cache_key, final_resp.dict(), ttl=30)
        return final_resp
    except Exception as e:
        logger.error(f"Error during screening: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/screen-watch")
async def screen_watch_list(symbols: List[str] = Query(["BBCA", "ASII", "BANK"])):
    try:
        screener.set_mode(ScreenerMode.DAYTRADE)
        stock_data = generate_screening_data(symbols=symbols)
        results = screener.screen_all_stocks(stock_data)
        response_results = [
            {
                "symbol": r.symbol,
                "score": r.score,
                "rank": r.rank,
                "recommendation": r.recommendation,
                "current_price": r.current_price,
                "volatility": r.volatility_percent,
                "pressure": r.pressure_score,
            }
            for r in results
        ]
        return {
            "timestamp": datetime.now().isoformat(),
            "watched_symbols": symbols,
            "results": response_results,
        }
    except Exception as e:
        logger.error(f"Error screening watch list: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# --- Utilities ---


def get_all_symbols() -> List[str]:
    try:
        return fetch_all_symbols()
    except Exception as e:
        logger.warning(f"Failed to fetch symbols from DB: {e}, using fallback list")
        return [
            "BBCA", "ASII", "UNVR", "INDF", "ICBP",  # Blue chips
            "TLKM", "JSMR", "ADRO", "ANTM", "PGAS",  # Sectoral
            "BBRI", "BBNI", "BMRI", "BDMN", "BNBA",  # Banks
            "PROL", "INCO", "TINS", "MEDC", "TOWR",  # Smaller caps
        ]


def generate_screening_data(symbols: List[str]) -> List[Dict]:
    """Create screener payload from real DB-backed market data with deterministic fallback."""
    data: List[Dict] = []

    for symbol in symbols:
        trades = fetch_recent_trades(symbol=symbol, limit=500, lookback_minutes=180)
        ohlc = fetch_ohlc_data(symbol=symbol, interval_minutes=5, lookback_hours=12)
        broker_flows = fetch_broker_flows(symbol=symbol, days=7)
        anomalies = fetch_anomalies(symbol=symbol, lookback_hours=6)

        if not trades and not ohlc:
            continue

        latest_price = 0.0
        if trades:
            latest_price = float(trades[0].get('price') or 0)
        elif ohlc:
            latest_price = float(ohlc[0].get('close') or 0)

        closes = [float(c.get('close') or 0) for c in reversed(ohlc) if c.get('close') is not None]
        atr_percent = 0.0
        if len(closes) >= 2 and latest_price > 0:
            diffs = [abs(closes[i] - closes[i - 1]) for i in range(1, len(closes))]
            atr_percent = (sum(diffs) / len(diffs)) / latest_price * 100

        haka_volume = sum(int(t.get('volume') or 0) for t in trades if str(t.get('trade_type') or '').upper() == 'HAKA')
        haki_volume = sum(int(t.get('volume') or 0) for t in trades if str(t.get('trade_type') or '').upper() == 'HAKI')
        total_volume = sum(int(t.get('volume') or 0) for t in trades)
        denom = haka_volume + haki_volume
        haka_ratio = float(haka_volume) / float(denom) if denom > 0 else 0.5

        patterns: List[Dict] = []
        if len(closes) >= 6:
            momentum = closes[-1] - closes[-6]
            trend_up = momentum > 0
            confidence = min(0.92, 0.6 + (abs(momentum) / max(1.0, closes[-6])) * 3)
            patterns.append({
                "pattern_name": "Momentum Continuation" if trend_up else "Momentum Breakdown",
                "pattern_type": "BULLISH" if trend_up else "BEARISH",
                "confidence": round(confidence, 3),
                "entry_price": latest_price,
                "target_price": latest_price * (1.03 if trend_up else 0.97),
                "stop_loss": latest_price * (0.98 if trend_up else 1.02),
            })

        data.append({
            'symbol': symbol,
            'current_price': latest_price,
            'atr_percent': atr_percent,
            'patterns': patterns,
            'broker_flows': broker_flows,
            'heatmap': {
                'haka_volume': haka_volume,
                'haki_volume': haki_volume,
                'total_volume': total_volume,
                'haka_ratio': haka_ratio,
            },
            'anomalies': anomalies,
        })

    return data


