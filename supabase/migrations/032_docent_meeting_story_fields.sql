-- 032: Store Step 4 docent meeting state separately from Tori story chat

ALTER TABLE stories
  ADD COLUMN IF NOT EXISTS docent_chat_log JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS docent_recommendations JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS selected_activity JSONB;

NOTIFY pgrst, 'reload schema';
