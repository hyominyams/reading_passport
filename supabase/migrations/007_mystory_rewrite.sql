-- ============================================================
-- 007: MyStory 8-Step Rewrite
-- 챗봇 게이지 → 8단계 가이드 창작 흐름 (주인공 설정 포함)
-- ============================================================

-- stories 테이블 확장
ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS current_step INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS guide_answers JSONB,
  ADD COLUMN IF NOT EXISTS student_freewrite TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_images TEXT[],
  ADD COLUMN IF NOT EXISTS scene_descriptions TEXT[],
  ADD COLUMN IF NOT EXISTS illustration_style TEXT,
  ADD COLUMN IF NOT EXISTS cover_design JSONB,
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT,
  ADD COLUMN IF NOT EXISTS character_designs JSONB,
  ADD COLUMN IF NOT EXISTS production_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS production_progress INTEGER NOT NULL DEFAULT 0;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_stories_current_step ON stories(current_step);
CREATE INDEX IF NOT EXISTS idx_stories_production_status ON stories(production_status);

-- ============================================================
-- country_facts: 세계 상식 (제작 대기 화면용)
-- ============================================================
CREATE TABLE IF NOT EXISTS country_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id TEXT NOT NULL,
  fact_text TEXT NOT NULL,
  fact_text_en TEXT,
  "order" INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_country_facts_country ON country_facts(country_id);

-- RLS
ALTER TABLE country_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read facts"
  ON country_facts FOR SELECT
  USING (true);

CREATE POLICY "Admin can manage facts"
  ON country_facts FOR ALL
  USING (is_admin());
