ALTER TABLE classes
ADD COLUMN IF NOT EXISTS mystory_required_turns INTEGER NOT NULL DEFAULT 5;

ALTER TABLE classes
ADD CONSTRAINT classes_mystory_required_turns_check
CHECK (mystory_required_turns BETWEEN 3 AND 20);
