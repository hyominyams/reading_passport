DROP POLICY IF EXISTS "Students can manage own activities" ON activities;
CREATE POLICY "Students can manage own activities"
  ON activities FOR ALL
  USING (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
  );

DROP POLICY IF EXISTS "Students can manage own chat logs" ON chat_logs;
CREATE POLICY "Students can manage own chat logs"
  ON chat_logs FOR ALL
  USING (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
  );

DROP POLICY IF EXISTS "Students can manage own stories" ON stories;
CREATE POLICY "Students can manage own stories"
  ON stories FOR ALL
  USING (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
  )
  WITH CHECK (
    public.current_user_role() = 'student'
    AND student_id = auth.uid()
  );

DROP POLICY IF EXISTS "Library items created via story visibility" ON library;
CREATE POLICY "Library items created via story visibility"
  ON library FOR INSERT
  WITH CHECK (
    public.current_user_role() = 'student'
    AND EXISTS (
      SELECT 1
      FROM public.stories
      WHERE stories.id = library.story_id
        AND stories.student_id = auth.uid()
    )
  );
