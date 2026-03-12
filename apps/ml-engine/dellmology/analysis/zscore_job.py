"""Broker Z-Score job

Computes z-score per broker from `broker_summaries` and writes results
into the `broker_zscore` hypertable used by the dashboard.
"""
import logging
import statistics
from typing import List
from datetime import datetime

from ..utils.db_utils import get_db_connection

logger = logging.getLogger(__name__)


def compute_and_store_zscores(symbols: List[str] = None, lookback_days: int = 30):
    """Compute z-scores for each broker for given symbols and store them.
    If symbols is None, compute for top symbols found in broker_summaries.
    """
    try:
        with get_db_connection() as conn:
            # Determine symbols if not provided
            if not symbols:
                rows = conn.execute("SELECT DISTINCT symbol FROM broker_summaries ORDER BY symbol LIMIT 50").fetchall()
                symbols = [r[0] for r in rows]

            for sym in symbols:
                try:
                    # Get list of brokers for symbol
                    brokers = conn.execute("SELECT DISTINCT broker_id FROM broker_summaries WHERE symbol = :sym", {"sym": sym}).fetchall()
                    for b in brokers:
                        broker = b[0]
                        # fetch last `lookback_days` net_buy_value values (most recent first)
                        rows = conn.execute(
                            "SELECT net_buy_value FROM broker_summaries WHERE symbol = :sym AND broker_id = :broker ORDER BY date DESC LIMIT :lim",
                            {"sym": sym, "broker": broker, "lim": int(lookback_days)}
                        ).fetchall()
                        vals = [r[0] for r in rows if r[0] is not None]
                        if len(vals) < 2:
                            z = 0.0
                        else:
                            try:
                                mean = statistics.mean(vals)
                                stdev = statistics.stdev(vals)
                                z = 0.0 if stdev == 0 else (vals[0] - mean) / stdev
                            except Exception:
                                z = 0.0

                        is_anom = abs(z) >= 2.5
                        # Insert into broker_zscore hypertable
                        try:
                            insert_q = """
                            INSERT INTO broker_zscore (time, symbol, broker_code, net_volume, z_score, is_anomaly)
                            VALUES (NOW(), :symbol, :broker, :netv, :z, :anom)
                            """
                            # net_volume use latest value or 0
                            netv = vals[0] if vals else 0
                            conn.execute(insert_q, {"symbol": sym, "broker": broker, "netv": netv, "z": float(z), "anom": bool(is_anom)})
                        except Exception:
                            logger.exception(f"Failed to insert z-score for {sym} {broker}")
                except Exception:
                    logger.exception(f"Failed processing symbol {sym}")
            # Commit if using transactional connection
            try:
                conn.commit()
            except Exception:
                pass
    except Exception:
        logger.exception("compute_and_store_zscores failed")


if __name__ == '__main__':
    compute_and_store_zscores()
