DROP POLICY IF EXISTS sc_teacher_insert ON story_comments;
DROP POLICY IF EXISTS "Teachers can add comments" ON story_comments;

CREATE POLICY sc_teacher_insert
  ON story_comments FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.stories
      WHERE stories.id = story_comments.story_id
        AND public.is_teacher_of(stories.student_id)
    )
  );
