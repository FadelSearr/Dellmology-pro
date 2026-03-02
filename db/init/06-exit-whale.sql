-- table for recording detected whale exits (large net sell events)

CREATE TABLE IF NOT EXISTS exit_whale_events (
    id BIGSERIAL,
    time TIMESTAMPTZ NOT NULL DEFAULT now(),
    symbol VARCHAR(10) NOT NULL,
    broker_id VARCHAR(10),
    net_value BIGINT,
    z_score FLOAT,
    note TEXT,
    PRIMARY KEY (id)
);

SELECT create_hypertable('exit_whale_events', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_exit_whale_symbol_time ON exit_whale_events (symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_exit_whale_netvalue ON exit_whale_events (net_value DESC);
