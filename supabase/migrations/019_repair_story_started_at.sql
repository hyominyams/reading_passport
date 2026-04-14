-- ============================================================
-- 019: Repair story started_at after story versioning rollout
-- Existing rows could inherit the migration execution timestamp
-- instead of their original creation time.
-- ============================================================

UPDATE stories
SET started_at = created_at
WHERE created_at IS NOT NULL
  AND started_at > created_at;
