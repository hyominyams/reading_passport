ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS purpose_answers JSONB;
