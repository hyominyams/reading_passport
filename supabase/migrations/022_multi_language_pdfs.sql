-- ============================================================
-- 022: Multi-Language PDF Support
-- Migrate from fixed pdf_url_ko / pdf_url_en columns to a
-- flexible pdf_urls JSONB map (e.g. {"ko":"…","en":"…","vi":"…"}).
-- ============================================================

-- 1. Add pdf_urls JSONB column to books
ALTER TABLE books ADD COLUMN IF NOT EXISTS pdf_urls JSONB DEFAULT '{}';

-- 2. Backfill pdf_urls from legacy columns
UPDATE books
SET pdf_urls = (
  COALESCE(
    CASE WHEN pdf_url_ko IS NOT NULL AND pdf_url_ko <> ''
         THEN jsonb_build_object('ko', pdf_url_ko)
         ELSE '{}'::jsonb END,
    '{}'::jsonb
  ) ||
  COALESCE(
    CASE WHEN pdf_url_en IS NOT NULL AND pdf_url_en <> ''
         THEN jsonb_build_object('en', pdf_url_en)
         ELSE '{}'::jsonb END,
    '{}'::jsonb
  )
)
WHERE pdf_urls = '{}'::jsonb OR pdf_urls IS NULL;

-- 3. Widen languages_available from language_code[] to text[]
ALTER TABLE books
  ALTER COLUMN languages_available TYPE TEXT[]
  USING languages_available::TEXT[];

-- 4. Widen language columns from language_code enum to text
ALTER TABLE activities  ALTER COLUMN language TYPE TEXT USING language::TEXT;
ALTER TABLE chat_logs   ALTER COLUMN language TYPE TEXT USING language::TEXT;
ALTER TABLE stories     ALTER COLUMN language TYPE TEXT USING language::TEXT;

-- 5. Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
