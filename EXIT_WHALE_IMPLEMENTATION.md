# Exit Whale & Liquidity Hunt (Phase 5)

This feature identifies when a broker performs an unusually large net sell
activity at the end of the day – a potential sign of an "exit whale" or
liquidity drainage. The detection runs immediately after the existing
broker-flow job and makes the results available to the dashboard.

## Database changes

* Added `db/init/06-exit-whale.sql`:
  * Table `exit_whale_events` with timestamp, symbol, broker_id, net_value, etc.
  * Hypertable and indexes for efficient time‑series queries.

## Backend job (`apps/ml-engine/exit_whale.py`)

* `detect_exit_whales(conn, threshold)` inspects today's `broker_summaries`.
  - Default threshold controlled by `EXIT_WHALE_THRESHOLD` env var (50M by
    default).
  - Inserts any broker whose `net_buy_value` is less than `-threshold`.
* `main()` wraps the detection for cron scheduling.
* `get_db_conn()` uses `DATABASE_URL`.

## Scheduler integration

* `apps/ml-engine/main.py` updated:
  ```python
  from exit_whale import main as exit_whale_main
  # ...
  scheduler.add_job(lambda: exit_whale_main(), 'cron', hour=18, minute=15, id='exit_whale')
  ```
* Ensures exit‑whale job runs shortly after broker‑flow.

## API route

* New endpoint `GET /api/exit-whale` in `apps/web/src/app/api/exit-whale/route.ts`.
  - Accepts optional `symbol` and `days` query parameters.
  - Returns JSON list of events.

## Frontend

* Created `ExitWhaleTable` component showing events.
* Integrated component into `page.tsx` below AI narrative.
* Added import and rendering logic with state tracking.

## Tests

* `apps/ml-engine/tests/test_exit_whale.py` covers
  `detect_exit_whales()` with dummy connections.
* Ensures threshold logic and commit behavior.

## Usage

1. Deploy updated schema (run migrations or execute the new SQL file).
2. Set `EXIT_WHALE_THRESHOLD` if you want a different sensitivity.
3. Ensure cron job is active (restart API server).
4. Dashboard will show a new "Exit Whale Alerts" section when events exist.

## Example API call

```bash
curl 'https://<host>/api/exit-whale?symbol=BBCA&days=3'
```

Returns:

```json
{
  "events": [
    {"symbol":"BBCA","broker_id":"PD","net_value":-120000000,"time":"2026-03-02T11:00:00Z","z_score":null,"note":null}
  ]
}
```

## Next steps

* Expand logic to incorporate z-score anomaly detection or order-flow
  confirmation.
* Provide filters and alert settings in the UI.
* Add notification mechanism (e.g. Telegram) when exit whales are detected.

---

This completes the initial implementation of Phase 5 (exit whale detection).
Feel free to iterate further or pick another roadmap feature.