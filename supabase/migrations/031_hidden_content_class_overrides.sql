CREATE TABLE IF NOT EXISTS hidden_content_class_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hidden_content_id UUID NOT NULL REFERENCES hidden_content(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  hidden BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (hidden_content_id, class_id)
);

CREATE INDEX IF NOT EXISTS idx_hidden_content_class_overrides_class
  ON hidden_content_class_overrides(class_id, hidden_content_id);

CREATE OR REPLACE FUNCTION update_hidden_content_class_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hidden_content_class_overrides_updated_at ON hidden_content_class_overrides;
CREATE TRIGGER hidden_content_class_overrides_updated_at
  BEFORE UPDATE ON hidden_content_class_overrides
  FOR EACH ROW
  EXECUTE FUNCTION update_hidden_content_class_overrides_updated_at();

ALTER TABLE hidden_content_class_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers can manage own class hidden content overrides" ON hidden_content_class_overrides;
CREATE POLICY "Teachers can manage own class hidden content overrides"
  ON hidden_content_class_overrides FOR ALL
  USING (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM classes
      WHERE classes.id = hidden_content_class_overrides.class_id
        AND classes.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    teacher_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM classes
      WHERE classes.id = hidden_content_class_overrides.class_id
        AND classes.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Students can read own class hidden content overrides" ON hidden_content_class_overrides;
CREATE POLICY "Students can read own class hidden content overrides"
  ON hidden_content_class_overrides FOR SELECT
  USING (
    public.current_user_role() = 'student'
    AND class_id = public.current_user_class_id()
  );

DROP POLICY IF EXISTS "Admins can manage hidden content overrides" ON hidden_content_class_overrides;
CREATE POLICY "Admins can manage hidden content overrides"
  ON hidden_content_class_overrides FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
