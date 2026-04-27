-- 028: Collapse story library visibility to public/secret.
-- Legacy class/private story visibility values become secret.

DROP POLICY IF EXISTS "Users can read stories visible to them" ON stories;
DROP POLICY IF EXISTS "Public stories are readable by all" ON stories;
DROP POLICY IF EXISTS st_public ON stories;

DROP TYPE IF EXISTS visibility_v2;
CREATE TYPE visibility_v2 AS ENUM ('public', 'secret');

ALTER TABLE stories
  ALTER COLUMN visibility DROP DEFAULT;

ALTER TABLE stories
  ALTER COLUMN visibility TYPE visibility_v2
  USING (
    CASE
      WHEN visibility::TEXT = 'public' THEN 'public'
      ELSE 'secret'
    END
  )::visibility_v2;

ALTER TABLE stories
  ALTER COLUMN visibility SET DEFAULT 'public';

DROP TYPE visibility;

ALTER TYPE visibility_v2 RENAME TO visibility;

CREATE POLICY "Users can read stories visible to them"
  ON stories FOR SELECT
  USING (
    visibility = 'public'
    OR student_id = auth.uid()
    OR (
      visibility = 'secret'
      AND (
        public.is_teacher_of(student_id)
        OR public.is_admin()
      )
    )
  );

NOTIFY pgrst, 'reload schema';
