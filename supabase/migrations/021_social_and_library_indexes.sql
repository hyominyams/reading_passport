-- ============================================================
-- 021: Social + library query indexes
-- library, likes, comments, teacher-owned content 조회 성능 보강
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_story_likes_story_id
  ON story_likes(story_id);

CREATE INDEX IF NOT EXISTS idx_story_likes_user_id
  ON story_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_story_comments_story_created_at
  ON story_comments(story_id, created_at);

CREATE INDEX IF NOT EXISTS idx_story_comments_user_id
  ON story_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_library_likes
  ON library(likes DESC, story_id);

CREATE INDEX IF NOT EXISTS idx_library_views
  ON library(views DESC, story_id);

CREATE INDEX IF NOT EXISTS idx_books_created_by
  ON books(created_by);

CREATE INDEX IF NOT EXISTS idx_hidden_content_created_by
  ON hidden_content(created_by);
