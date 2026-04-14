-- ============================================================
-- 015: Admin workflow alignment
-- Admin approval audit, enum alignment, and atomic review handling
-- ============================================================

ALTER TYPE chat_type ADD VALUE IF NOT EXISTS 'questions';
ALTER TYPE stamp_type ADD VALUE IF NOT EXISTS 'questions';

UPDATE activities
SET stamps_earned = array_replace(stamps_earned, 'character'::stamp_type, 'questions'::stamp_type)
WHERE 'character'::stamp_type = ANY(stamps_earned);

ALTER TABLE approval_requests
  ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS content_title TEXT,
  ADD COLUMN IF NOT EXISTS content_scope content_scope;

UPDATE approval_requests AS ar
SET
  content_title = COALESCE(ar.content_title, b.title),
  content_scope = COALESCE(ar.content_scope, b.scope)
FROM books AS b
WHERE ar.content_type = 'book'
  AND ar.content_id = b.id;

UPDATE approval_requests AS ar
SET
  content_title = COALESCE(ar.content_title, hc.title),
  content_scope = COALESCE(ar.content_scope, hc.scope)
FROM hidden_content AS hc
WHERE ar.content_type = 'hidden_content'
  AND ar.content_id = hc.id;

CREATE OR REPLACE FUNCTION public.process_admin_approval(
  p_request_id UUID,
  p_reviewer_id UUID,
  p_status approval_status,
  p_review_note TEXT DEFAULT NULL
)
RETURNS approval_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request approval_requests%ROWTYPE;
  v_note TEXT;
BEGIN
  IF p_status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Unsupported approval status: %', p_status;
  END IF;

  SELECT *
  INTO v_request
  FROM approval_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Approval request not found: %', p_request_id;
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Approval request is already processed: %', v_request.status;
  END IF;

  v_note := NULLIF(BTRIM(COALESCE(p_review_note, '')), '');

  IF p_status = 'approved' THEN
    IF v_request.content_type = 'book' THEN
      UPDATE books
      SET approved = true,
          scope = 'global'
      WHERE id = v_request.content_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Book content not found for request %', p_request_id;
      END IF;
    ELSIF v_request.content_type = 'hidden_content' THEN
      UPDATE hidden_content
      SET approved = true,
          scope = 'global'
      WHERE id = v_request.content_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Hidden content not found for request %', p_request_id;
      END IF;
    ELSE
      RAISE EXCEPTION 'Unsupported content type: %', v_request.content_type;
    END IF;
  END IF;

  UPDATE approval_requests
  SET status = p_status,
      reviewed_at = NOW(),
      reviewer_id = p_reviewer_id,
      review_note = v_note
  WHERE id = p_request_id;

  SELECT *
  INTO v_request
  FROM approval_requests
  WHERE id = p_request_id;

  RETURN v_request;
END;
$$;
