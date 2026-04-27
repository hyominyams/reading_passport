-- ============================================================
-- 024: World Smart question board
-- 3단계 질문 게시판, 답변, 채택, 배지 집계를 위한 스키마
-- ============================================================

DO $$
BEGIN
  CREATE TYPE question_board_category AS ENUM ('content', 'character', 'world', 'action');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS question_posts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_name TEXT NOT NULL DEFAULT '',
  chat_log_id UUID REFERENCES chat_logs(id) ON DELETE SET NULL,
  question_type question_board_category NOT NULL,
  question_text TEXT NOT NULL,
  adopted_answer_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(student_id, book_id, question_type, question_text)
);

CREATE TABLE IF NOT EXISTS question_answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES question_posts(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(post_id, student_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'question_posts_adopted_answer_id_fkey'
  ) THEN
    ALTER TABLE question_posts
      ADD CONSTRAINT question_posts_adopted_answer_id_fkey
      FOREIGN KEY (adopted_answer_id)
      REFERENCES question_answers(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_question_posts_book_scope
  ON question_posts(book_id, teacher_id, class_name, question_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_posts_student_created_at
  ON question_posts(student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_question_posts_adopted_answer_id
  ON question_posts(adopted_answer_id);

CREATE INDEX IF NOT EXISTS idx_question_answers_post_created_at
  ON question_answers(post_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_question_answers_student_created_at
  ON question_answers(student_id, created_at DESC);

ALTER TABLE question_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can read own World Smart posts"
  ON question_posts FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can read class World Smart posts"
  ON question_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users me
      WHERE me.id = auth.uid()
        AND me.role = 'student'
        AND me.teacher_id = question_posts.teacher_id
        AND COALESCE(me.class, '') = question_posts.class_name
    )
  );

CREATE POLICY "Teachers can read own World Smart posts"
  ON question_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users me
      WHERE me.id = auth.uid()
        AND me.role = 'teacher'
        AND me.id = question_posts.teacher_id
    )
  );

CREATE POLICY "Admins can read all World Smart posts"
  ON question_posts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
    )
  );

CREATE POLICY "Students can insert own World Smart posts"
  ON question_posts FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM users me
      WHERE me.id = auth.uid()
        AND me.role = 'student'
        AND me.teacher_id = question_posts.teacher_id
        AND COALESCE(me.class, '') = question_posts.class_name
    )
  );

CREATE POLICY "Students can update own World Smart posts"
  ON question_posts FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM users me
      WHERE me.id = auth.uid()
        AND me.role = 'student'
        AND me.teacher_id = question_posts.teacher_id
        AND COALESCE(me.class, '') = question_posts.class_name
    )
  );

CREATE POLICY "Admins can manage all World Smart posts"
  ON question_posts FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM users me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
    )
  );

CREATE POLICY "Students can read own World Smart answers"
  ON question_answers FOR SELECT
  USING (auth.uid() = student_id);

CREATE POLICY "Students can read class World Smart answers"
  ON question_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM question_posts post
      JOIN users me
        ON me.id = auth.uid()
      WHERE post.id = question_answers.post_id
        AND me.role = 'student'
        AND me.teacher_id = post.teacher_id
        AND COALESCE(me.class, '') = post.class_name
    )
  );

CREATE POLICY "Teachers can read own World Smart answers"
  ON question_answers FOR SELECT
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

CREATE POLICY "Admins can read all World Smart answers"
  ON question_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM users me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
    )
  );

CREATE POLICY "Students can insert own World Smart answers"
  ON question_answers FOR INSERT
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM question_posts post
      JOIN users me
        ON me.id = auth.uid()
      WHERE post.id = question_answers.post_id
        AND me.role = 'student'
        AND me.teacher_id = post.teacher_id
        AND COALESCE(me.class, '') = post.class_name
        AND post.student_id <> auth.uid()
    )
  );

CREATE POLICY "Students can update own World Smart answers"
  ON question_answers FOR UPDATE
  USING (auth.uid() = student_id)
  WITH CHECK (
    auth.uid() = student_id
    AND EXISTS (
      SELECT 1
      FROM question_posts post
      JOIN users me
        ON me.id = auth.uid()
      WHERE post.id = question_answers.post_id
        AND me.role = 'student'
        AND me.teacher_id = post.teacher_id
        AND COALESCE(me.class, '') = post.class_name
        AND post.student_id <> auth.uid()
    )
  );

CREATE POLICY "Students can delete own World Smart answers"
  ON question_answers FOR DELETE
  USING (auth.uid() = student_id);

CREATE POLICY "Admins can manage all World Smart answers"
  ON question_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM users me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
    )
  );
