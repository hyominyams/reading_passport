ALTER TABLE activities
ADD COLUMN IF NOT EXISTS read_question_seed TEXT;

ALTER TABLE activities
ADD COLUMN IF NOT EXISTS explore_challenges JSONB NOT NULL DEFAULT '[]'::jsonb;
