-- ============================================================
-- 027: World Smart answer moderation
-- 교사/admin 댓글 숨김, 삭제, 관리 기록을 위한 스키마
-- ============================================================

ALTER TABLE question_answers
  ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'visible',
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS moderation_reason TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'question_answers_moderation_status_check'
  ) THEN
    ALTER TABLE question_answers
      ADD CONSTRAINT question_answers_moderation_status_check
      CHECK (moderation_status IN ('visible', 'hidden'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_question_answers_moderation_status
  ON question_answers(moderation_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS question_moderation_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('answer')),
  target_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('hide', 'unhide', 'delete')),
  moderator_id UUID REFERENCES users(id) ON DELETE SET NULL,
  moderator_role TEXT NOT NULL,
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_question_moderation_logs_target
  ON question_moderation_logs(target_type, target_id, created_at DESC);

ALTER TABLE question_moderation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can read own World Smart moderation logs"
  ON question_moderation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM question_answers answer
      JOIN question_posts post
        ON post.id = answer.post_id
      JOIN users me
        ON me.id = auth.uid()
      WHERE answer.id = question_moderation_logs.target_id
        AND question_moderation_logs.target_type = 'answer'
        AND me.role = 'teacher'
        AND me.id = post.teacher_id
    )
  );

CREATE POLICY "Admins can read all World Smart moderation logs"
  ON question_moderation_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
    )
  );

CREATE POLICY "Teachers can update own World Smart answers"
  ON question_answers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM question_posts post
      JOIN users me
        ON me.id = auth.uid()
      WHERE post.id = question_answers.post_id
        AND me.role = 'teacher'
        AND me.id = post.teacher_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM question_posts post
      JOIN users me
        ON me.id = auth.uid()
      WHERE post.id = question_answers.post_id
        AND me.role = 'teacher'
        AND me.id = post.teacher_id
    )
  );

CREATE POLICY "Teachers can delete own World Smart answers"
  ON question_answers FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM question_posts post
      JOIN users me
        ON me.id = auth.uid()
      WHERE post.id = question_answers.post_id
        AND me.role = 'teacher'
        AND me.id = post.teacher_id
    )
  );
