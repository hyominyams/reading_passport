-- ============================================================
-- 011: Library story metadata snapshot
-- 도서관 업로드 시 썸네일/제목/저자 닉네임 스냅샷 보관
-- ============================================================

ALTER TABLE library
  ADD COLUMN IF NOT EXISTS story_title TEXT,
  ADD COLUMN IF NOT EXISTS author_nickname TEXT,
  ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

UPDATE library AS l
SET
  story_title = COALESCE(
    NULLIF(BTRIM(l.story_title), ''),
    NULLIF(BTRIM(s.cover_design ->> 'title'), '')
  ),
  author_nickname = COALESCE(
    NULLIF(BTRIM(l.author_nickname), ''),
    NULLIF(BTRIM(u.nickname), '')
  ),
  thumbnail_url = COALESCE(
    NULLIF(BTRIM(l.thumbnail_url), ''),
    NULLIF(BTRIM(s.cover_image_url), ''),
    NULLIF(BTRIM(s.cover_design ->> 'image_url'), ''),
    NULLIF(BTRIM(s.scene_images[1]), ''),
    NULLIF(BTRIM(b.cover_url), '')
  )
FROM stories AS s
LEFT JOIN users AS u
  ON u.id = s.student_id
LEFT JOIN books AS b
  ON b.id = s.book_id
WHERE l.story_id = s.id;
