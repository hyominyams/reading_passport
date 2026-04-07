-- Align class-scoped visibility with teacher/student relationships already stored in users.

DROP POLICY IF EXISTS "Anyone authenticated can read approved hidden content" ON hidden_content;

CREATE POLICY "Users can read hidden content available to them"
  ON hidden_content FOR SELECT
  USING (
    approved = true
    AND (
      scope = 'global'
      OR (
        scope = 'class'
        AND EXISTS (
          SELECT 1
          FROM classes
          JOIN users viewer ON viewer.id = auth.uid()
          WHERE classes.id = hidden_content.class_id
            AND viewer.teacher_id = classes.teacher_id
            AND COALESCE(viewer.class, '') = classes.class_name
        )
      )
    )
  );

DROP POLICY IF EXISTS "Public stories are readable by all" ON stories;

CREATE POLICY "Users can read stories visible to them"
  ON stories FOR SELECT
  USING (
    visibility = 'public'
    OR student_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM users author
      JOIN users viewer ON viewer.id = auth.uid()
      WHERE author.id = stories.student_id
        AND viewer.teacher_id = author.teacher_id
        AND COALESCE(viewer.class, '') = COALESCE(author.class, '')
        AND stories.visibility = 'class'
    )
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE id = stories.student_id
        AND teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
