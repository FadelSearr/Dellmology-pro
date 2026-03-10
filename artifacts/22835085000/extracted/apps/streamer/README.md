## Streamer - Real-time Market Data Service

Go-based high-performance service for handling real-time market data streams from Stockbit.

### Directory Structure

```
streamer/
├── cmd/
│   └── streamer/        # Application entry point
│       └── main.go
│
├── internal/            # Private packages (not importable)
│   ├── models/          # Data structures
│   │   └── types.go
│   ├── data/            # Data storage and streaming
│   │   ├── storage.go
│   │   └── streaming.go
│   ├── analysis/        # Market analysis
│   │   ├── broker.go    # Broker flow & Z-Score
│   │   └── market.go    # Regime detection
│   └── order/           # Order flow analysis
│       └── flow.go      # Heatmap & big walls
│
├── config/              # Configuration management
│   └── config.go
│
├── go.mod               # Module definition
├── go.sum               # Dependency checksums
├── README.md
```

### Features

- **Real-time WebSocket Streaming**: Connects to Stockbit WebSocket for live market data
- **Trade Detection**: HAKA/HAKI (aggressive buy/sell) detection
- **Broker Flow Analysis**: Z-Score based whale detection
- **Order Flow Heatmap**: Big walls and liquidity analysis
- **Market Regime**: Uptrend, Downtrend, Sideways detection
- **Rate-of-Change Alerts**: Detect sudden price drops

### Building

```bash
cd apps/streamer
go mod tidy
go build -o streamer cmd/streamer/main.go
```

### Running

```bash
./streamer
```

### Dependencies

- github.com/gorilla/websocket - WebSocket handling
- github.com/go-redis/redis/v8 - Redis caching
- github.com/lib/pq - PostgreSQL driver

### Configuration

Set environment variables:

```bash
export TOKEN_API_URL=http://localhost:3000/api/session
export WEBSOCKET_URL=wss://stream.stockbit.com/stream
export DATABASE_URL=postgresql://admin:password@localhost:5433/dellmology
export REDIS_HOST=localhost
export REDIS_PORT=6379
export SYSTEM_CONTROL_URL=http://localhost:3000/api/system-control
export WORKER_RESET_URL=http://localhost:3000/api/system-control/worker-reset
export WORKER_HEARTBEAT_URL=http://localhost:3000/api/worker-heartbeat
export WORKER_HEARTBEAT_INTERVAL_SECONDS=300
export WORKER_HEARTBEAT_TIMEOUT_SECONDS=8
export TELEGRAM_HEARTBEAT_URL=http://localhost:3000/api/telegram-alert
export TELEGRAM_HEARTBEAT_INTERVAL_SECONDS=300
export TELEGRAM_OFFLINE_THRESHOLD_SECONDS=600
export TELEGRAM_EMERGENCY_ALERT_COOLDOWN_SECONDS=600
export TELEGRAM_HEARTBEAT_TIMEOUT_SECONDS=8
```

### API Endpoints

- `POST /websocket` - WebSocket upgrade endpoint
- `GET /health` - Service health check
- `GET /heartbeat` - Worker runtime heartbeat telemetry (stale seconds, queue depth, dead-letter count)
- `GET /stats` - Real-time statistics

### Cloud Dead-Man Integration

Streamer now publishes heartbeat to Web API (`/api/worker-heartbeat`) on startup and every 5 minutes (default).
This enables dashboard lock + offline Telegram alert flow when the local worker stops sending heartbeat.

Streamer also polls Cloud System Control (`/api/system-control`) every 1 minute.
If `is_system_active=false`, the active websocket stream is closed and worker ingestion is paused until the flag is re-enabled.

If Cloud Worker Reset (`/api/system-control/worker-reset`) is requested, streamer will acknowledge reset,
close active websocket, and reconnect with a fresh session/token cycle.

Streamer also sends Telegram heartbeat ping via Web API (`/api/telegram-alert`) every 5 minutes (default).
If stream data is stale for more than 10 minutes (configurable), it emits emergency alert:
`DELLMOLOGY OFFLINE - CHECK POSITION MANUALLY!` and sends recovery alert once data flow resumes.

### Performance

- Handles 1000+ concurrent streams
- Sub-millisecond latency
- Redis-backed caching
- Connection pooling to database
