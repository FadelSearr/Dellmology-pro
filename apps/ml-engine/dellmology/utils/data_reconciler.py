"""Data Integrity Reconciler

Periodic job that checks for gaps or missing data and records anomalies
into `order_flow_anomalies` when gaps are detected.
"""
from datetime import datetime, timedelta, timezone
import logging
from typing import List

from .db_utils import get_db_connection, fetch_all_symbols
from ..data_integrity import detect_gap

logger = logging.getLogger(__name__)


class DataReconciler:
    def __init__(self, symbols: List[str] = None, gap_threshold_seconds: int = 60):
        # If symbols not provided, fetch from DB
        self.symbols = symbols
        self.gap_threshold = gap_threshold_seconds

    def _ensure_symbols(self):
        if not self.symbols:
            try:
                self.symbols = fetch_all_symbols()
            except Exception:
                self.symbols = ["BBCA"]

    def _latest_timestamp(self, conn, table: str, symbol: str):
        q = f"SELECT time FROM {table} WHERE symbol = :symbol ORDER BY time DESC LIMIT 1"
        try:
            r = conn.execute(q, {"symbol": symbol}).fetchone()
            if r and r[0]:
                return r[0]
        except Exception:
            return None
        return None

    def _insert_anomaly(self, conn, symbol: str, severity: str, desc: str):
        try:
            insert_q = """
            INSERT INTO order_flow_anomalies (time, symbol, anomaly_type, severity, description)
            VALUES (NOW(), :symbol, :atype, :severity, :desc)
            """
            conn.execute(insert_q, {"symbol": symbol, "atype": "DATA_GAP", "severity": severity, "desc": desc})
            logger.info(f"Inserted DATA_GAP anomaly for {symbol}: {desc}")
        except Exception:
            logger.exception("Failed to insert anomaly record")

    def run_once(self):
        """Run one reconciliation pass over configured symbols."""
        self._ensure_symbols()
        now = datetime.now(timezone.utc)
        try:
            with get_db_connection() as conn:
                for sym in self.symbols:
                    try:
                        # Check latest in order_flow_heatmap
                        latest_heatmap = self._latest_timestamp(conn, 'order_flow_heatmap', sym)
                        if latest_heatmap is None:
                            # no data at all
                            desc = f"No heatmap data for {sym}"
                            self._insert_anomaly(conn, sym, 'HIGH', desc)
                            continue

                        # compute gap to now
                        gap_seconds = (now - latest_heatmap).total_seconds()
                        if gap_seconds > self.gap_threshold:
                            desc = f"Latest heatmap at {latest_heatmap.isoformat()} (gap {int(gap_seconds)}s)"
                            self._insert_anomaly(conn, sym, 'HIGH', desc)

                        # Additionally check trades table for intra-stream gaps
                        # fetch last two timestamps
                        try:
                            rows = conn.execute(
                                "SELECT timestamp FROM trades WHERE symbol = :symbol ORDER BY timestamp DESC LIMIT 10",
                                {"symbol": sym}
                            ).fetchall()
                            if rows and len(rows) >= 2:
                                prev = rows[0][0]
                                for r in rows[1:]:
                                    cur = r[0]
                                    if detect_gap(cur, prev, threshold_seconds=self.gap_threshold):
                                        desc = f"Detected gap between {cur.isoformat()} and {prev.isoformat()}"
                                        self._insert_anomaly(conn, sym, 'MEDIUM', desc)
                                        break
                                    prev = cur
                        except Exception:
                            # best-effort, ignore
                            pass

                    except Exception:
                        logger.exception(f"Reconciler failed for symbol {sym}")
        except Exception:
            logger.exception("DataReconciler run_once failed")


def run_reconciler_job(symbols: List[str] = None, gap_threshold_seconds: int = 60):
    r = DataReconciler(symbols=symbols, gap_threshold_seconds=gap_threshold_seconds)
    r.run_once()
