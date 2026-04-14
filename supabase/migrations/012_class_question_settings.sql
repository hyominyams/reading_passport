ALTER TABLE classes
ADD COLUMN IF NOT EXISTS questions_required_count INTEGER NOT NULL DEFAULT 7;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'classes_questions_required_count_check'
  ) THEN
    ALTER TABLE classes
    ADD CONSTRAINT classes_questions_required_count_check
    CHECK (questions_required_count BETWEEN 4 AND 11);
  END IF;
END $$;
