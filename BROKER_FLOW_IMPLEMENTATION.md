# Broker Flow Engine (Phase 3)

This document explains implementation details for the post‑market broker flow analysis component of Dellmology Pro. The functionality covers fetching end‑of‑day broker summaries, calculating metrics such as net buy value, consistency and z‑score, storing them in the database, and exposing them via API for the dashboard.

## Database Schema

Broker summary records are stored in the existing `broker_summaries` table (created in `db/init/01-schema.sql`). Columns include:

- `date` (DATE) – trading day
- `symbol` (VARCHAR) – stock symbol
- `broker_id` (VARCHAR) – broker code
- `net_buy_value` (BIGINT) – buy minus sell value
- `avg_buy_price` (DECIMAL)
- `avg_sell_price` (DECIMAL)

An additional helper table `broker_flow` was added (`db/init/05-broker-flow.sql`) for internal analytics and future extensions; it is currently unused by the UI but may house richer per‑broker statistics.

## Cron Job Script

File: `apps/ml-engine/broker_flow.py`

- `fetch_broker_summary(symbol)` retrieves data from Stockbit using the stored bearer token (`STOCKBIT_TOKEN`).
- `compute_consistency()` computes the ratio of days with activity over the past 7 days.
- `compute_zscore()` calculates a 30‑day z‑score for the current net value.
- `store_entries()` writes or updates rows in `broker_summaries` and optionally `broker_flow`.

The script can be executed manually or by a scheduler (`cron`, `apscheduler`, etc.). Environment variables:

```text
DATABASE_URL=postgres://...    # Supabase/TimescaleDB
STOCKBIT_TOKEN=<your token>
BROKER_FLOW_SYMBOLS=BBCA,TLKM,...
```

### Running

```bash
python apps/ml-engine/broker_flow.py
```

or call `python -c "from apps.ml_engine.broker_flow import main; main(['BBCA'])"`.

## API Route

Path: `apps/web/src/app/api/broker-flow/route.ts` (edge function)

Accepts query parameters:

- `symbol` (required)
- `days` (optional; default 7)
- `filter` (`mix`|`whale`|`retail`|`smart_money`)

Returns JSON with broker list, z‑scores, stats and wash‑sale score.

## Frontend Component

`apps/web/src/components/BrokerFlowTable.tsx` renders a table showing broker net values, days active, consistency, average price and z‑score. The main page (`app/page.tsx`) fetches data and displays the component beneath the FlowEngine widget.

## Unit Tests

- `apps/ml-engine/tests/test_broker_flow.py` verifies z‑score and consistency calculations and database insert logic using mock connections.

## Deployment Notes

- Ensure `BROKER_FLOW_SYMBOLS` or an alternate inventory of symbols is available in the environment for the cron job.
- Schema migrations: run `supabase db push --file db/init/05-broker-flow.sql` in addition to other scripts.

## Next Steps for Phase 3

- Implement scheduling (e.g. `apscheduler` job registered in `apps/ml-engine/main.py`).
- Build UI filters (whale/retail/smart money) and heatmap visualizations as per the Roadmap.
- Add Telegram or alerting rules based on large net flows or wash‑sale scores.

The system is now capable of computing broker flow metrics that feed the Advanced Screener and Flow Engine components.