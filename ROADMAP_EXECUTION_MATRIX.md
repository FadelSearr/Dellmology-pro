# Roadmap Execution Matrix (Post Single-Pass)

| Workstream | Status | Owner | Dependency | DoD | ETA |
|---|---|---|---|---|---|
| P0 Real Signal Path | Completed | ML + Web | DB trades/broker_flow | Screener/path runtime non-mock | Done |
| P0 Telegram Live Send | Completed | ML | TELEGRAM env | Alert terkirim ke Bot API | Done |
| P1 Negotiated/Cross API | Completed | Streamer + Web | trades trade_type NEGO/CROSS | Endpoint + panel ringkas aktif | Done |
| P1 Iceberg Detector | Completed | Streamer | depth feed | Anomali ICEBERG masuk order_flow_anomalies | Done |
| P1 Whale Cluster API Layer | Completed | Web API | broker_flow | cluster + correlation field tersedia | Done |
| P1 Whale Cluster Native Engine | In Progress | Streamer | broker_analysis integration callsite | scoring native engine dipakai pipeline | 1 sprint |
| P1 Commodity Correlation Engine | In Progress | Web API | external market feed | endpoint correlation aktif + consumed by UI | 1 sprint |
| P1 Sentiment Multi-Source | In Progress | Web API | external feeds | google+reddit+stocktwits agregasi aktif | 1 sprint |
| P2 External Queue Broker | In Progress | Streamer | Redis | publish/subscribe stabil + fallback local | 1 sprint |
| P2 RLS Full Coverage | In Progress | DB | Supabase roles | policy read/write lintas tabel order_flow/broker_flow | 1 sprint |
| P2 Operational Guardrails | In Progress | Web + Streamer | trade freshness + external check | heartbeat/fallback/cross-check lock endpoint aktif | 1 sprint |
| Dashboard Shell page.tsx | Completed | Web | page.tsx patched via terminal | panel nego/cross consume `/api/negotiated-monitor` | Done |
| ROADMAP.md inline update | Completed | Docs | ROADMAP.md patched via terminal | pointer ke matrix eksekusi tertanam | Done |

## Notes
- File jumbo (`page.tsx`, `ROADMAP.md`) telah diselesaikan via jalur terminal langsung karena batas sinkronisasi extension untuk file >50MB.
- Matrix ini tetap menjadi ringkasan status eksekusi lintas workstream.
