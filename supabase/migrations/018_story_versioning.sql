-- ============================================================
-- 018: Story versioning for MyStory
-- draft / completed / archived 상태와 completed_at 이력 추가
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'story_status'
  ) THEN
    CREATE TYPE story_status AS ENUM ('draft', 'completed', 'archived');
  END IF;
END $$;

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS story_status story_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE stories
SET started_at = COALESCE(started_at, created_at);

WITH story_flags AS (
  SELECT
    s.id,
    CASE
      WHEN EXISTS (
        SELECT 1
        FROM library AS l
        WHERE l.story_id = s.id
      ) OR COALESCE(s.current_step, 1) >= 8
      THEN true
      ELSE false
    END AS should_be_completed,
    ROW_NUMBER() OVER (
      PARTITION BY s.student_id, s.book_id
      ORDER BY COALESCE(s.started_at, s.created_at) DESC, s.created_at DESC, s.id DESC
    ) AS recency_rank
  FROM stories AS s
),
resolved_status AS (
  SELECT
    id,
    CASE
      WHEN should_be_completed THEN 'completed'::story_status
      WHEN recency_rank = 1 THEN 'draft'::story_status
      ELSE 'archived'::story_status
    END AS next_status
  FROM story_flags
)
UPDATE stories AS s
SET
  story_status = r.next_status,
  completed_at = CASE
    WHEN r.next_status = 'completed' THEN COALESCE(s.completed_at, s.created_at)
    ELSE NULL
  END
FROM resolved_status AS r
WHERE s.id = r.id;

CREATE INDEX IF NOT EXISTS idx_stories_student_book_status
  ON stories(student_id, book_id, story_status);

CREATE INDEX IF NOT EXISTS idx_stories_completed_at
  ON stories(completed_at DESC NULLS LAST);

CREATE UNIQUE INDEX IF NOT EXISTS idx_stories_active_draft
  ON stories(student_id, book_id)
  WHERE story_status = 'draft';
