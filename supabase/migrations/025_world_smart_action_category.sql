-- ============================================================
-- 025: Rename World Smart inference category to action
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'question_board_category'
      AND e.enumlabel = 'inference'
  ) THEN
    ALTER TYPE question_board_category RENAME VALUE 'inference' TO 'action';
  END IF;
END $$;
