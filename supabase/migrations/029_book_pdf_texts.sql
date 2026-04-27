CREATE TABLE IF NOT EXISTS book_pdf_texts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  extraction_type TEXT NOT NULL DEFAULT 'full_text',
  source_language TEXT NOT NULL DEFAULT 'default',
  source_pdf_url TEXT,
  source_hash TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'stale')),
  extracted_text TEXT,
  extracted_text_chars INTEGER NOT NULL DEFAULT 0 CHECK (extracted_text_chars >= 0),
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (book_id, extraction_type, source_language)
);

CREATE INDEX IF NOT EXISTS idx_book_pdf_texts_book_status
  ON book_pdf_texts(book_id, extraction_type, status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_book_pdf_texts_source_hash
  ON book_pdf_texts(source_hash);

CREATE OR REPLACE FUNCTION update_book_pdf_texts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS book_pdf_texts_updated_at ON book_pdf_texts;
CREATE TRIGGER book_pdf_texts_updated_at
  BEFORE UPDATE ON book_pdf_texts
  FOR EACH ROW
  EXECUTE FUNCTION update_book_pdf_texts_updated_at();

ALTER TABLE book_pdf_texts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read extracted pdf text for visible books" ON book_pdf_texts;
CREATE POLICY "Users can read extracted pdf text for visible books"
  ON book_pdf_texts FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_pdf_texts.book_id
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

DROP POLICY IF EXISTS "Teachers and admins can manage extracted pdf text" ON book_pdf_texts;
CREATE POLICY "Teachers and admins can manage extracted pdf text"
  ON book_pdf_texts FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM books
      WHERE books.id = book_pdf_texts.book_id
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
      WHERE books.id = book_pdf_texts.book_id
        AND (
          books.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
          )
        )
    )
  );
