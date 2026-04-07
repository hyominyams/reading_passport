-- ============================================================
-- World Docent - Initial Database Schema
-- ============================================================

-- Enums
CREATE TYPE user_role AS ENUM ('admin', 'teacher', 'student');
CREATE TYPE content_scope AS ENUM ('global', 'class');
CREATE TYPE content_type AS ENUM ('video', 'pdf', 'image', 'link');
CREATE TYPE chat_type AS ENUM ('character', 'story_gauge');
CREATE TYPE story_type AS ENUM ('continue', 'new_protagonist', 'extra_backstory', 'change_ending', 'custom');
CREATE TYPE visibility AS ENUM ('public', 'class', 'private');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE language_code AS ENUM ('ko', 'en');
CREATE TYPE stamp_type AS ENUM ('read', 'hidden', 'character', 'mystory');

-- ============================================================
-- Users
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role user_role NOT NULL DEFAULT 'student',
  school TEXT,
  grade INTEGER,
  class TEXT,
  nickname TEXT,
  avatar TEXT,
  student_code VARCHAR(6) UNIQUE,
  teacher_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_student_code ON users(student_code);
CREATE INDEX idx_users_teacher_id ON users(teacher_id);

-- ============================================================
-- Classes
-- ============================================================
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  class_code VARCHAR(8) NOT NULL UNIQUE,
  school TEXT NOT NULL,
  grade INTEGER NOT NULL,
  class_name TEXT NOT NULL
);

CREATE INDEX idx_classes_teacher_id ON classes(teacher_id);
CREATE INDEX idx_classes_class_code ON classes(class_code);

-- ============================================================
-- Books
-- ============================================================
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_id TEXT NOT NULL,
  title TEXT NOT NULL,
  cover_url TEXT NOT NULL,
  pdf_url_ko TEXT,
  pdf_url_en TEXT,
  languages_available language_code[] NOT NULL DEFAULT '{ko}',
  character_analysis JSONB DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  scope content_scope NOT NULL DEFAULT 'global',
  class_id UUID REFERENCES classes(id),
  approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_books_country_id ON books(country_id);
CREATE INDEX idx_books_scope ON books(scope);
CREATE INDEX idx_books_approved ON books(approved);

-- ============================================================
-- Hidden Content
-- ============================================================
CREATE TABLE hidden_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  type content_type NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL REFERENCES users(id),
  scope content_scope NOT NULL DEFAULT 'global',
  class_id UUID REFERENCES classes(id),
  approved BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_hidden_content_book_id ON hidden_content(book_id);
CREATE INDEX idx_hidden_content_country_id ON hidden_content(country_id);

-- ============================================================
-- Activities
-- ============================================================
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  language language_code NOT NULL DEFAULT 'ko',
  emotion TEXT,
  one_line TEXT,
  completed_tabs TEXT[] NOT NULL DEFAULT '{}',
  stamps_earned stamp_type[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_student_id ON activities(student_id);
CREATE INDEX idx_activities_book_id ON activities(book_id);
CREATE UNIQUE INDEX idx_activities_student_book ON activities(student_id, book_id);

-- ============================================================
-- Chat Logs
-- ============================================================
CREATE TABLE chat_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  character_id TEXT,
  character_name TEXT,
  chat_type chat_type NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  language language_code NOT NULL DEFAULT 'ko',
  flagged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE INDEX idx_chat_logs_student_id ON chat_logs(student_id);
CREATE INDEX idx_chat_logs_book_id ON chat_logs(book_id);
CREATE INDEX idx_chat_logs_flagged ON chat_logs(flagged);

-- ============================================================
-- Stories
-- ============================================================
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  language language_code NOT NULL DEFAULT 'ko',
  story_type story_type NOT NULL,
  custom_input TEXT,
  chat_log JSONB DEFAULT '{}',
  all_student_messages TEXT,
  gauge_final INTEGER NOT NULL DEFAULT 0,
  ai_draft JSONB,
  final_text TEXT[],
  character_refs JSONB,
  scene_images TEXT[],
  translation_text TEXT[],
  pdf_url_original TEXT,
  pdf_url_translated TEXT,
  visibility visibility NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stories_student_id ON stories(student_id);
CREATE INDEX idx_stories_book_id ON stories(book_id);
CREATE INDEX idx_stories_visibility ON stories(visibility);

-- ============================================================
-- Library
-- ============================================================
CREATE TABLE library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  country_id TEXT NOT NULL,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  likes INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_library_story_id ON library(story_id);
CREATE INDEX idx_library_country_id ON library(country_id);
CREATE UNIQUE INDEX idx_library_story ON library(story_id);

-- ============================================================
-- Approval Requests
-- ============================================================
CREATE TABLE approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('book', 'hidden_content')),
  content_id UUID NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_approval_requests_status ON approval_requests(status);
CREATE INDEX idx_approval_requests_requester ON approval_requests(requester_id);

-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE hidden_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE library ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Teachers can read their students"
  ON users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'teacher')
    AND teacher_id = auth.uid()
  );

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins can update any user"
  ON users FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Service role can insert users"
  ON users FOR INSERT
  WITH CHECK (true);

-- Classes policies
CREATE POLICY "Teachers can manage own classes"
  ON classes FOR ALL
  USING (teacher_id = auth.uid());

CREATE POLICY "Admins can manage all classes"
  ON classes FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Students can read their class"
  ON classes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND teacher_id = classes.teacher_id
    )
  );

-- Books policies
CREATE POLICY "Anyone authenticated can read approved books"
  ON books FOR SELECT
  USING (approved = true);

CREATE POLICY "Teachers can read own books"
  ON books FOR SELECT
  USING (created_by = auth.uid());

CREATE POLICY "Teachers can insert books"
  ON books FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
  );

CREATE POLICY "Teachers can update own books"
  ON books FOR UPDATE
  USING (created_by = auth.uid());

CREATE POLICY "Admins can manage all books"
  ON books FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Hidden content policies
CREATE POLICY "Anyone authenticated can read approved hidden content"
  ON hidden_content FOR SELECT
  USING (approved = true);

CREATE POLICY "Teachers can manage own hidden content"
  ON hidden_content FOR ALL
  USING (created_by = auth.uid());

CREATE POLICY "Admins can manage all hidden content"
  ON hidden_content FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Activities policies
CREATE POLICY "Students can manage own activities"
  ON activities FOR ALL
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can read student activities"
  ON activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = activities.student_id
      AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all activities"
  ON activities FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Chat logs policies
CREATE POLICY "Students can manage own chat logs"
  ON chat_logs FOR ALL
  USING (student_id = auth.uid());

CREATE POLICY "Teachers can read student chat logs"
  ON chat_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = chat_logs.student_id
      AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all chat logs"
  ON chat_logs FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Stories policies
CREATE POLICY "Students can manage own stories"
  ON stories FOR ALL
  USING (student_id = auth.uid());

CREATE POLICY "Public stories are readable by all"
  ON stories FOR SELECT
  USING (visibility = 'public');

CREATE POLICY "Teachers can read student stories"
  ON stories FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = stories.student_id
      AND teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all stories"
  ON stories FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Library policies
CREATE POLICY "Anyone authenticated can read library"
  ON library FOR SELECT
  USING (true);

CREATE POLICY "Library items created via story visibility"
  ON library FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM stories
      WHERE stories.id = library.story_id
      AND stories.student_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all library items"
  ON library FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Approval requests policies
CREATE POLICY "Teachers can create approval requests"
  ON approval_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid());

CREATE POLICY "Users can read own requests"
  ON approval_requests FOR SELECT
  USING (requester_id = auth.uid());

CREATE POLICY "Admins can manage all approval requests"
  ON approval_requests FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- Story Likes (좋아요)
-- ============================================================
CREATE TABLE story_likes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(story_id, user_id)
);

-- ============================================================
-- Story Comments (교사 댓글)
-- ============================================================
CREATE TABLE story_comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  story_id UUID REFERENCES stories(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS for story_likes
ALTER TABLE story_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view likes" ON story_likes FOR SELECT USING (true);
CREATE POLICY "Authenticated can toggle likes" ON story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own likes" ON story_likes FOR DELETE USING (auth.uid() = user_id);

-- RLS for story_comments
ALTER TABLE story_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comments" ON story_comments FOR SELECT USING (true);
CREATE POLICY "Teachers can add comments" ON story_comments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('teacher', 'admin'))
);
CREATE POLICY "Authors can delete own comments" ON story_comments FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- Seed default admin user
-- ============================================================
-- Note: This requires the admin user to already exist in auth.users.
-- In production, create the admin user via Supabase dashboard first,
-- then run this insert with the actual UUID.
-- For development, this serves as a template:
-- INSERT INTO users (id, email, role)
-- VALUES ('REPLACE_WITH_ADMIN_AUTH_UUID', 'admin@worlddocent.com', 'admin');
