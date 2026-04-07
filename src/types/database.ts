export type UserRole = 'admin' | 'teacher' | 'student';
export type ContentScope = 'global' | 'class';
export type ContentType = 'video' | 'pdf' | 'image' | 'link';
export type ChatType = 'character' | 'story_gauge';
export type StoryType = 'continue' | 'new_protagonist' | 'extra_backstory' | 'change_ending' | 'custom';
export type Visibility = 'public' | 'class' | 'private';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type Language = 'ko' | 'en';
export type StampType = 'read' | 'hidden' | 'character' | 'mystory';

export interface User {
  id: string;
  email: string | null;
  role: UserRole;
  school: string | null;
  grade: number | null;
  class: string | null;
  nickname: string | null;
  avatar: string | null;
  student_code: string | null;
  teacher_id: string | null;
  created_at: string;
}

export interface Class {
  id: string;
  teacher_id: string;
  class_code: string;
  school: string;
  grade: number;
  class_name: string;
}

export interface Book {
  id: string;
  country_id: string;
  title: string;
  cover_url: string;
  pdf_url_ko: string | null;
  pdf_url_en: string | null;
  languages_available: Language[];
  character_analysis: Record<string, unknown>;
  created_by: string;
  scope: ContentScope;
  class_id: string | null;
  approved: boolean;
  created_at: string;
}

export interface HiddenContent {
  id: string;
  book_id: string;
  country_id: string;
  type: ContentType;
  title: string;
  url: string;
  order: number;
  created_by: string;
  scope: ContentScope;
  class_id: string | null;
  approved: boolean;
}

export interface Activity {
  id: string;
  student_id: string;
  book_id: string;
  country_id: string;
  language: Language;
  emotion: string | null;
  one_line: string | null;
  completed_tabs: string[];
  stamps_earned: StampType[];
  created_at: string;
}

export interface ChatMessage {
  role: string;
  content: string;
  timestamp: string;
}

export interface ChatLog {
  id: string;
  student_id: string;
  book_id: string;
  character_id: string | null;
  character_name: string | null;
  chat_type: ChatType;
  messages: ChatMessage[];
  language: Language;
  flagged: boolean;
  created_at: string;
  ended_at: string | null;
}

export interface CharacterRef {
  name: string;
  imageUrl: string;
}

export interface Story {
  id: string;
  student_id: string;
  book_id: string;
  country_id: string;
  language: Language;
  story_type: StoryType;
  custom_input: string | null;
  chat_log: Record<string, unknown>;
  all_student_messages: string | null;
  gauge_final: number;
  ai_draft: string[] | null;
  final_text: string[] | null;
  character_refs: CharacterRef[] | null;
  scene_images: string[] | null;
  translation_text: string[] | null;
  pdf_url_original: string | null;
  pdf_url_translated: string | null;
  visibility: Visibility;
  created_at: string;
}

export interface LibraryItem {
  id: string;
  story_id: string;
  country_id: string;
  book_id: string;
  likes: number;
  views: number;
}

export interface ApprovalRequest {
  id: string;
  requester_id: string;
  content_type: 'book' | 'hidden_content';
  content_id: string;
  status: ApprovalStatus;
  created_at: string;
  reviewed_at: string | null;
}
