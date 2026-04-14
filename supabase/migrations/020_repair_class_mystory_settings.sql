-- ============================================================
-- 020: Repair classes My World settings column
-- Some environments recorded migration 008 in history without
-- actually materializing the mystory_required_turns column.
-- Reconcile the real schema and refresh PostgREST cache.
-- ============================================================

ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS mystory_required_turns INTEGER NOT NULL DEFAULT 5;

UPDATE public.classes
SET mystory_required_turns = 5
WHERE mystory_required_turns IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'classes_mystory_required_turns_check'
  ) THEN
    ALTER TABLE public.classes
    ADD CONSTRAINT classes_mystory_required_turns_check
    CHECK (mystory_required_turns BETWEEN 3 AND 20);
  END IF;
END $$;

ALTER TABLE public.classes
ALTER COLUMN mystory_required_turns SET DEFAULT 5;

ALTER TABLE public.classes
ALTER COLUMN mystory_required_turns SET NOT NULL;

NOTIFY pgrst, 'reload schema';
