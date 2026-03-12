-- Add a persistent flag to record whether an exit_whale event was sent to Telegram
ALTER TABLE IF EXISTS exit_whale_events
ADD COLUMN IF NOT EXISTS sent_to_telegram BOOLEAN DEFAULT FALSE;

-- Create index to quickly find unsent events
CREATE INDEX IF NOT EXISTS idx_exit_whale_sent_false ON exit_whale_events (sent_to_telegram) WHERE sent_to_telegram = false;
