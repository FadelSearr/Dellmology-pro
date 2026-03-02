-- broker flow summary per day and per broker

CREATE TABLE IF NOT EXISTS broker_flow (
    time DATE NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    broker_code VARCHAR(10) NOT NULL,
    buy_volume BIGINT DEFAULT 0,
    sell_volume BIGINT DEFAULT 0,
    net_value BIGINT DEFAULT 0,
    consistency_score FLOAT DEFAULT 0,
    z_score FLOAT DEFAULT 0,
    PRIMARY KEY (time, symbol, broker_code)
);

SELECT create_hypertable('broker_flow', 'time', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_broker_flow_symbol ON broker_flow (symbol, time DESC);
CREATE INDEX IF NOT EXISTS idx_broker_flow_netvalue ON broker_flow (net_value DESC, symbol);
