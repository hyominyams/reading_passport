ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS translated_texts JSONB,
  ADD COLUMN IF NOT EXISTS translated_pdf_urls JSONB;

UPDATE stories
SET translated_texts = COALESCE(
  translated_texts,
  CASE
    WHEN translation_text IS NOT NULL THEN
      jsonb_build_object(
        CASE WHEN language = 'ko' THEN 'en' ELSE 'ko' END,
        to_jsonb(translation_text)
      )
    ELSE NULL
  END
)
WHERE translated_texts IS NULL;

UPDATE stories
SET translated_pdf_urls = COALESCE(
  translated_pdf_urls,
  CASE
    WHEN pdf_url_translated IS NOT NULL THEN
      jsonb_build_object(
        CASE WHEN language = 'ko' THEN 'en' ELSE 'ko' END,
        to_jsonb(pdf_url_translated)
      )
    ELSE NULL
  END
)
WHERE translated_pdf_urls IS NULL;
