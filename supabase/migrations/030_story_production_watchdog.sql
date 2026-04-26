-- 030: Track MyStory production heartbeat for watchdog recovery.

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS production_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS production_heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS production_error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_stories_processing_heartbeat
  ON stories(production_status, production_heartbeat_at)
  WHERE production_status = 'processing';
