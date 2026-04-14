-- Ensure story_read_progress exists even if an earlier migration was marked applied
-- in migration history without actually creating the table on the remote database.

CREATE TABLE IF NOT EXISTS public.story_read_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_page INTEGER NOT NULL DEFAULT 0,
  total_pages_snapshot INTEGER NOT NULL DEFAULT 0,
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_story_read_progress_story_id
  ON public.story_read_progress(story_id);

CREATE INDEX IF NOT EXISTS idx_story_read_progress_user_id
  ON public.story_read_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_story_read_progress_completed
  ON public.story_read_progress(completed);

ALTER TABLE public.story_read_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'story_read_progress'
      AND policyname = 'Users can read own story progress'
  ) THEN
    CREATE POLICY "Users can read own story progress"
      ON public.story_read_progress FOR SELECT
      USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'story_read_progress'
      AND policyname = 'Users can insert own story progress'
  ) THEN
    CREATE POLICY "Users can insert own story progress"
      ON public.story_read_progress FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'story_read_progress'
      AND policyname = 'Users can update own story progress'
  ) THEN
    CREATE POLICY "Users can update own story progress"
      ON public.story_read_progress FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'story_read_progress'
      AND policyname = 'Admins can manage all story progress'
  ) THEN
    CREATE POLICY "Admins can manage all story progress"
      ON public.story_read_progress FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
