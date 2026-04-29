-- 034: Replace AI Tori chat with structured Tori question cards.
-- Stores activity-specific question answers gathered before draft generation.

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS tori_answers JSONB;

NOTIFY pgrst, 'reload schema';
