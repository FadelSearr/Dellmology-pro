-- Create table to store model training metrics and metadata
CREATE TABLE IF NOT EXISTS model_metrics (
  id SERIAL PRIMARY KEY,
  symbol VARCHAR(32) NOT NULL,
  trained_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT now(),
  training_loss NUMERIC NULL,
  validation_accuracy NUMERIC NULL,
  training_time_seconds INTEGER NULL,
  model_size_mb NUMERIC NULL,
  notes TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_model_metrics_symbol ON model_metrics(symbol);
