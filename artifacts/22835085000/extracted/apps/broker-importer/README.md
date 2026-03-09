## Broker Importer - EOD Broker Flow Service

Go-based service for End-of-Day (EOD) broker summary data import and analysis.

### Directory Structure

```
broker-importer/
├── cmd/
│   └── importer/        # Application entry point
│       └── main.go
│
├── internal/            # Private packages
│   ├── models.go        # Data structures
│   └── storage.go       # Database operations
│
├── go.mod
├── go.sum
├── README.md
```

### Features

- **EOD Broker Data Import**: Fetches broker summaries after market close
- **Flow Analysis**: Calculates net buy/sell per broker
- **Persistence**: Stores data in PostgreSQL TimescaleDB
- **Mock Data Generation** (for testing): Generates realistic broker flow patterns

### Building

```bash
cd apps/broker-importer
go mod tidy
go build -o broker-importer cmd/importer/main.go
```

### Running

```bash
./broker-importer
```

### Dependencies

- github.com/lib/pq - PostgreSQL driver

### Configuration

Set environment variables:

```bash
export DATABASE_URL=postgresql://admin:password@localhost:5433/dellmology
```

### Database Schema Required

```sql
CREATE TABLE IF NOT EXISTS broker_summaries (
    id SERIAL PRIMARY KEY,
    symbol TEXT NOT NULL,
    broker_code TEXT NOT NULL,
    buy_value BIGINT,
    sell_value BIGINT,
    buy_lot BIGINT,
    sell_lot BIGINT,
    date TIMESTAMP DEFAULT NOW(),
    UNIQUE(symbol, broker_code, date)
);
```
