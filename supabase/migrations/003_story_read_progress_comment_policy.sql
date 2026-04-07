-- Read progress tracking for comment eligibility.

CREATE TABLE IF NOT EXISTS story_read_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_page INTEGER NOT NULL DEFAULT 0,
  total_pages_snapshot INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_story_read_progress_story_id
  ON story_read_progress(story_id);

CREATE INDEX IF NOT EXISTS idx_story_read_progress_user_id
  ON story_read_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_story_read_progress_completed
  ON story_read_progress(completed);

ALTER TABLE story_read_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own story progress"
  ON story_read_progress FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own story progress"
  ON story_read_progress FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own story progress"
  ON story_read_progress FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all story progress"
  ON story_read_progress FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "Teachers can add comments" ON story_comments;

CREATE POLICY "Completed readers can add comments"
  ON story_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM story_read_progress progress
      JOIN stories story ON story.id = progress.story_id
      WHERE progress.story_id = story_comments.story_id
        AND progress.user_id = auth.uid()
        AND progress.completed = true
        AND story.student_id <> auth.uid()
    )
  );
