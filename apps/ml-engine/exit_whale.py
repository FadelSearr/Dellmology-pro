"""Post-market exit-whale detection

Analyzes the most recent broker summary data and flags brokers that performed
unusually large net sell (distribution) activity. These events are stored in
the `exit_whale_events` table for later consumption by the API and dashboard.

A simple threshold is used by default; you can also supply an environment
variable `EXIT_WHALE_THRESHOLD` specifying the minimum absolute net sell value
(a positive integer, e.g. 50000000 for 50 million IDR). A broker whose
`net_buy_value` is less than `-threshold` will be recorded. In future the logic
could include z-score anomalies or cross-referencing order-flow data.
"""

import os
import psycopg2
from datetime import date

DB_URL = os.environ.get("DATABASE_URL")
EXIT_THRESHOLD = abs(int(os.environ.get("EXIT_WHALE_THRESHOLD", "50000000")))


def get_db_conn():
    if not DB_URL:
        raise RuntimeError("DATABASE_URL not set")
    return psycopg2.connect(DB_URL)


def detect_exit_whales(conn, threshold: int = EXIT_THRESHOLD):
    """Query today\'s broker_summaries and insert events where a broker sold
    net volume exceeding the threshold.

    Returns a list of inserted event tuples for testing purposes.
    """
    today = date.today()
    inserted = []
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT symbol, broker_id, net_buy_value
            FROM broker_summaries
            WHERE date = %s AND net_buy_value <= %s
            """,
            (today, -threshold),
        )
        rows = cur.fetchall()
        # additional safety filter in Python so tests using dummy cursor work correctly
        for sym, broker, net in rows:
            if net <= -threshold:
                cur.execute(
                    "INSERT INTO exit_whale_events (symbol, broker_id, net_value) "
                    "VALUES (%s,%s,%s)",
                    (sym, broker, net),
                )
                inserted.append((sym, broker, net))
    conn.commit()
    return inserted


def main(symbols=None):
    # symbols argument ignored for now; detection is global across all symbols
    conn = get_db_conn()
    events = detect_exit_whales(conn)
    conn.close()
    if events:
        print(f"detected {len(events)} exit whale events: {events}")
    else:
        print("no exit whales detected today")


if __name__ == "__main__":
    main()
