-- Fix recursive RLS policies by resolving role/class information through
-- SECURITY DEFINER helpers instead of querying public.users from policies.

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.users
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.current_user_teacher_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT teacher_id
  FROM public.users
  WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.user_teacher_id(target_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT teacher_id
  FROM public.users
  WHERE id = target_user_id
$$;

CREATE OR REPLACE FUNCTION public.user_class_id(target_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH target_user AS (
    SELECT
      id,
      COALESCE(teacher_id, id) AS owner_teacher_id,
      NULLIF(BTRIM(class), '') AS class_value
    FROM public.users
    WHERE id = target_user_id
  )
  SELECT COALESCE(
    (
      SELECT class_value::uuid
      FROM target_user
      WHERE class_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
    (
      SELECT classes.id
      FROM target_user
      JOIN public.classes
        ON classes.teacher_id = target_user.owner_teacher_id
       AND classes.class_name = target_user.class_value
      LIMIT 1
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_class_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_class_id(auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT role = 'admin'
    FROM public.users
    WHERE id = auth.uid()
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT role = 'teacher'
    FROM public.users
    WHERE id = auth.uid()
  ), false)
$$;

CREATE OR REPLACE FUNCTION public.is_teacher_of(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = target_user_id
      AND teacher_id = auth.uid()
  )
$$;

DROP POLICY IF EXISTS users_admin_read ON users;
DROP POLICY IF EXISTS users_admin_update ON users;

DROP POLICY IF EXISTS classes_admin ON classes;
DROP POLICY IF EXISTS classes_student_read ON classes;

DROP POLICY IF EXISTS books_admin ON books;
DROP POLICY IF EXISTS books_teacher_insert ON books;
DROP POLICY IF EXISTS books_read_approved ON books;

DROP POLICY IF EXISTS hc_admin ON hidden_content;
DROP POLICY IF EXISTS hc_read_approved ON hidden_content;

DROP POLICY IF EXISTS act_admin ON activities;
DROP POLICY IF EXISTS act_teacher_read ON activities;

DROP POLICY IF EXISTS cl_admin ON chat_logs;
DROP POLICY IF EXISTS cl_teacher ON chat_logs;

DROP POLICY IF EXISTS st_admin ON stories;
DROP POLICY IF EXISTS st_teacher ON stories;

DROP POLICY IF EXISTS lib_admin ON library;

DROP POLICY IF EXISTS ar_admin ON approval_requests;

DROP POLICY IF EXISTS "Admins can read all users" ON users;
CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can read their students" ON users;
CREATE POLICY "Teachers can read their students"
  ON users FOR SELECT
  USING (public.is_teacher() AND teacher_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update any user" ON users;
CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all classes" ON classes;
CREATE POLICY "Admins can manage all classes"
  ON classes FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Students can read their class" ON classes;
CREATE POLICY "Students can read their class"
  ON classes FOR SELECT
  USING (
    public.current_user_role() = 'student'
    AND id = public.current_user_class_id()
  );

DROP POLICY IF EXISTS "Users can read books available to them" ON books;
CREATE POLICY "Users can read books available to them"
  ON books FOR SELECT
  USING (
    (
      approved = true
      AND scope = 'global'
    )
    OR (
      scope = 'class'
      AND class_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.classes
        WHERE classes.id = books.class_id
          AND (
            classes.teacher_id = auth.uid()
            OR (
              public.current_user_role() = 'student'
              AND classes.teacher_id = public.current_user_teacher_id()
              AND classes.id = public.current_user_class_id()
            )
          )
      )
    )
    OR created_by = auth.uid()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Teachers can insert books" ON books;
CREATE POLICY "Teachers can insert books"
  ON books FOR INSERT
  WITH CHECK (public.current_user_role() IN ('teacher', 'admin'));

DROP POLICY IF EXISTS "Admins can manage all books" ON books;
CREATE POLICY "Admins can manage all books"
  ON books FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Users can read hidden content available to them" ON hidden_content;
CREATE POLICY "Users can read hidden content available to them"
  ON hidden_content FOR SELECT
  USING (
    approved = true
    AND (
      scope = 'global'
      OR (
        scope = 'class'
        AND class_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.classes
          WHERE classes.id = hidden_content.class_id
            AND (
              classes.teacher_id = auth.uid()
              OR (
                public.current_user_role() = 'student'
                AND classes.teacher_id = public.current_user_teacher_id()
                AND classes.id = public.current_user_class_id()
              )
            )
        )
      )
    )
  );

DROP POLICY IF EXISTS "Admins can manage all hidden content" ON hidden_content;
CREATE POLICY "Admins can manage all hidden content"
  ON hidden_content FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Teachers can read student activities" ON activities;
CREATE POLICY "Teachers can read student activities"
  ON activities FOR SELECT
  USING (public.is_teacher_of(student_id));

DROP POLICY IF EXISTS "Admins can read all activities" ON activities;
CREATE POLICY "Admins can read all activities"
  ON activities FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Teachers can read student chat logs" ON chat_logs;
CREATE POLICY "Teachers can read student chat logs"
  ON chat_logs FOR SELECT
  USING (public.is_teacher_of(student_id));

DROP POLICY IF EXISTS "Admins can read all chat logs" ON chat_logs;
CREATE POLICY "Admins can read all chat logs"
  ON chat_logs FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can read stories visible to them" ON stories;
CREATE POLICY "Users can read stories visible to them"
  ON stories FOR SELECT
  USING (
    visibility = 'public'
    OR student_id = auth.uid()
    OR (
      visibility = 'class'
      AND (
        public.is_teacher_of(student_id)
        OR (
          public.current_user_role() = 'student'
          AND public.current_user_teacher_id() = public.user_teacher_id(student_id)
          AND public.current_user_class_id() IS NOT NULL
          AND public.current_user_class_id() = public.user_class_id(student_id)
        )
      )
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Teachers can read student stories" ON stories;
CREATE POLICY "Teachers can read student stories"
  ON stories FOR SELECT
  USING (public.is_teacher_of(student_id));

DROP POLICY IF EXISTS "Admins can read all stories" ON stories;
CREATE POLICY "Admins can read all stories"
  ON stories FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all library items" ON library;
CREATE POLICY "Admins can manage all library items"
  ON library FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all approval requests" ON approval_requests;
CREATE POLICY "Admins can manage all approval requests"
  ON approval_requests FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'story_comments'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS sc_teacher_insert ON story_comments';

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'story_read_progress'
    ) THEN
      EXECUTE '
        CREATE POLICY sc_teacher_insert
          ON story_comments FOR INSERT
          WITH CHECK (public.current_user_role() IN (''teacher'', ''admin''))
      ';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'story_read_progress'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can manage all story progress" ON story_read_progress';
    EXECUTE '
      CREATE POLICY "Admins can manage all story progress"
        ON story_read_progress FOR ALL
        USING (public.is_admin())
        WITH CHECK (public.is_admin())
    ';
  END IF;
END
$$;
