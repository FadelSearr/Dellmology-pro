#!/usr/bin/env python3
"""Lightweight RLS smoke check used by CI.

Connects to `DATABASE_URL` and prints roles, table rowsecurity, and policies
for a set of key tables.
"""
import os
import json
import sys
from sqlalchemy import create_engine, text


def main():
    db_url = os.getenv('DATABASE_URL') or 'postgresql://admin:password@localhost:5433/dellmology'
    engine = create_engine(db_url)
    tables = [
        'trades','broker_summaries','daily_prices','cnn_predictions','broker_flow',
        'order_flow_heatmap','order_flow_anomalies','order_events','broker_zscore',
        'market_depth','haka_haki_summary'
    ]
    out = {}
    try:
        with engine.connect() as conn:
            r = conn.execute(text("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','service_role')")).fetchall()
            out['roles'] = [row[0] for row in r]

            q = text("SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename = ANY(:tbls)")
            rows = conn.execute(q, {'tbls': tables}).fetchall()
            out['tables'] = [dict(r._mapping) for r in rows]

            q2 = text(
                "SELECT schemaname, tablename, policyname, permissive, roles, cmd FROM pg_policies WHERE schemaname='public' AND tablename = ANY(:tbls) ORDER BY tablename, policyname"
            )
            p = conn.execute(q2, {'tbls': tables}).fetchall()
            out['policies'] = [dict(r._mapping) for r in p]
    except Exception as e:
        print('ERROR', e, file=sys.stderr)
        return 2

    print(json.dumps(out, indent=2, default=str))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
