-- ============================================================
-- 026: Book analyses
-- Store full-book AI analysis outside the books row.
-- ============================================================

CREATE TABLE IF NOT EXISTS book_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL DEFAULT 'full_book',
  source_language TEXT NOT NULL DEFAULT 'default',
  source_pdf_url TEXT,
  source_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'stale')),
  model TEXT,
  prompt_version TEXT,
  analysis_json JSONB NOT NULL DEFAULT '{}',
  extracted_text_chars INTEGER NOT NULL DEFAULT 0 CHECK (extracted_text_chars >= 0),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, analysis_type, source_language)
);

CREATE INDEX IF NOT EXISTS idx_book_analyses_book_status
  ON book_analyses(book_id, analysis_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_analyses_source_hash
  ON book_analyses(source_hash);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'books'
      AND column_name = 'character_analysis'
  ) THEN
    EXECUTE $backfill$
      INSERT INTO book_analyses (
        book_id,
        analysis_type,
        source_language,
        status,
        model,
        prompt_version,
        analysis_json,
        extracted_text_chars,
        completed_at
      )
      SELECT
        id,
        'full_book',
        'legacy',
        'completed',
        'legacy',
        'legacy-character-analysis',
        character_analysis,
        length(character_analysis::text),
        now()
      FROM books
      WHERE character_analysis IS NOT NULL
        AND character_analysis <> '{}'::jsonb
      ON CONFLICT (book_id, analysis_type, source_language)
      DO UPDATE SET
        status = EXCLUDED.status,
        model = EXCLUDED.model,
        prompt_version = EXCLUDED.prompt_version,
        analysis_json = EXCLUDED.analysis_json,
        extracted_text_chars = EXCLUDED.extracted_text_chars,
        completed_at = EXCLUDED.completed_at,
        updated_at = now()
    $backfill$;

    ALTER TABLE books DROP COLUMN IF EXISTS character_analysis;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_book_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS book_analyses_updated_at ON book_analyses;
CREATE TRIGGER book_analyses_updated_at
  BEFORE UPDATE ON book_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_book_analyses_updated_at();

ALTER TABLE book_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read analyses for visible books" ON book_analyses;
CREATE POLICY "Users can read analyses for visible books"
  ON book_analyses FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_analyses.book_id
        AND (
          (books.approved = true AND books.scope = 'global')
          OR (
            books.scope = 'class'
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
          OR books.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Teachers and admins can manage book analyses" ON book_analyses;
CREATE POLICY "Teachers and admins can manage book analyses"
  ON book_analyses FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_analyses.book_id
        AND (
          books.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_analyses.book_id
        AND (
          books.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  );
