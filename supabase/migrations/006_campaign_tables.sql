-- ============================================================
-- Campaign System: Teacher-planned campaigns with student submissions
-- ============================================================

-- Enums
CREATE TYPE campaign_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE submission_status AS ENUM ('submitted', 'featured', 'hidden');

-- ============================================================
-- Campaigns (teacher-created)
-- ============================================================
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image_url TEXT,
  allowed_content_types TEXT[] NOT NULL DEFAULT '{other}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  status campaign_status NOT NULL DEFAULT 'draft',
  deadline TIMESTAMPTZ,
  max_files_per_submission INTEGER NOT NULL DEFAULT 3,
  max_file_size_mb INTEGER NOT NULL DEFAULT 5,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id),
  scope content_scope NOT NULL DEFAULT 'class',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_scope ON campaigns(scope);
CREATE INDEX idx_campaigns_deadline ON campaigns(deadline);

-- ============================================================
-- Campaign Submissions (student-created)
-- ============================================================
CREATE TABLE campaign_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL DEFAULT 'other',
  title TEXT NOT NULL,
  description TEXT,
  assets JSONB NOT NULL DEFAULT '[]',
  status submission_status NOT NULL DEFAULT 'submitted',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_submissions_campaign_id ON campaign_submissions(campaign_id);
CREATE INDEX idx_submissions_student_id ON campaign_submissions(student_id);
CREATE UNIQUE INDEX idx_submissions_campaign_student ON campaign_submissions(campaign_id, student_id);

-- ============================================================
-- Campaign Likes
-- ============================================================
CREATE TABLE campaign_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES campaign_submissions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(submission_id, user_id)
);

CREATE INDEX idx_campaign_likes_submission_id ON campaign_likes(submission_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_likes ENABLE ROW LEVEL SECURITY;

-- ── Campaigns ──

-- Teachers can manage their own campaigns
CREATE POLICY "Teachers can manage own campaigns"
  ON campaigns FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Students can view active campaigns from their teacher
CREATE POLICY "Students can view active campaigns"
  ON campaigns FOR SELECT
  USING (
    status = 'active'
    AND (
      scope = 'global'
      OR (
        scope = 'class'
        AND created_by = public.current_user_teacher_id()
      )
    )
  );

-- Admins can manage all campaigns
CREATE POLICY "Admins can manage all campaigns"
  ON campaigns FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Submissions ──

-- Students can manage their own submissions
CREATE POLICY "Students can manage own submissions"
  ON campaign_submissions FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Students can view non-hidden submissions in campaigns they can access
CREATE POLICY "Users can view submissions"
  ON campaign_submissions FOR SELECT
  USING (
    status != 'hidden'
    AND EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_submissions.campaign_id
        AND campaigns.status = 'active'
    )
  );

-- Teachers can view and update submissions for their own campaigns
CREATE POLICY "Teachers can manage campaign submissions"
  ON campaign_submissions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_submissions.campaign_id
        AND campaigns.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM campaigns
      WHERE campaigns.id = campaign_submissions.campaign_id
        AND campaigns.created_by = auth.uid()
    )
  );

-- Admins can manage all submissions
CREATE POLICY "Admins can manage all submissions"
  ON campaign_submissions FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Likes ──

CREATE POLICY "Anyone can view campaign likes"
  ON campaign_likes FOR SELECT USING (true);

CREATE POLICY "Authenticated can toggle campaign likes"
  ON campaign_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaign likes"
  ON campaign_likes FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Helper: count likes for a submission
-- ============================================================
CREATE OR REPLACE FUNCTION public.campaign_submission_like_count(p_submission_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*) FROM campaign_likes WHERE submission_id = p_submission_id
$$;

-- ============================================================
-- Auto-update updated_at on campaigns
-- ============================================================
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();
