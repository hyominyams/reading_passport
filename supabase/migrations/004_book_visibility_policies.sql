-- Align book visibility with global/class scope.

DROP POLICY IF EXISTS "Anyone authenticated can read approved books" ON books;

CREATE POLICY "Users can read books available to them"
  ON books FOR SELECT
  USING (
    (
      approved = true
      AND scope = 'global'
    )
    OR (
      scope = 'class'
      AND EXISTS (
        SELECT 1
        FROM classes
        JOIN users viewer ON viewer.id = auth.uid()
        WHERE classes.id = books.class_id
          AND (
            viewer.id = classes.teacher_id
            OR (
              viewer.teacher_id = classes.teacher_id
              AND COALESCE(viewer.class, '') = classes.class_name
            )
          )
      )
    )
    OR created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );
