export type UserRole = 'admin' | 'teacher' | 'student';
export type ContentScope = 'global' | 'class';
export type ContentType = 'video' | 'pdf' | 'image' | 'link';
export type ChatType = 'character' | 'story_gauge' | 'questions';
export type ProductionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type IllustrationStyle =
  | 'watercolor'
  | 'rough_drawing'
  | 'pastel'
  | 'collage'
  | 'woodblock'
  | 'cartoon_comic'
  | 'anime'
  | 'caricature'
  | 'three_d_clay'
  | 'stop_motion'
  | 'three_d_animation'
  | 'three_d_chibi';
export type CharacterGender = 'unspecified' | 'female' | 'male';
export type PictureBookShape = 'landscape_4_3' | 'portrait_3_4' | 'square_1_1';
export type StoryTranslationMap = Record<string, string[]>;
export type StoryTranslatedPdfMap = Record<string, string>;

export interface GuideAnswers {
  content: string;
  character: string;
  world: string;
}

export interface AiDraftPage {
  draft: string;
  advice: string;
}

export interface CoverDesign {
  title: string;
  author: string;
  image_url?: string;
  description?: string;
  picture_book_shape?: PictureBookShape;
}

export interface CharacterDesign {
  name: string;
  gender: CharacterGender;
  appearance: string;
  personality: string;
  imageUrl: string | null;
}

export interface BookCharacterProfile {
  name: string;
  role?: string;
  age?: string;
  personality?: string[];
  speech_style?: string;
  background?: string;
  core_emotion?: string;
  key_moments?: string;
  profile_prompt?: string;
}

export interface BookSettingSummary {
  time?: string;
  place?: string;
  social_context?: string;
  atmosphere?: string;
}

export interface BookPlotStructure {
  beginning?: string;
  middle?: string;
  climax?: string;
  ending?: string;
}

export interface BookCharacterAnalysis {
  story_summary: string;
  detailed_story_summary: string;
  setting: BookSettingSummary;
  plot_structure: BookPlotStructure;
  characters: BookCharacterProfile[];
  key_events: string[];
  plot_points: string[];
  themes: string[];
  important_objects: string[];
  emotional_keywords: string[];
  out_of_scope_topics: string[];
}

export interface CountryFact {
  id: string;
  country_id: string;
  fact_text: string;
  fact_text_en: string | null;
  order: number;
}
export type StoryType = 'continue' | 'new_protagonist' | 'extra_backstory' | 'change_ending' | 'custom';
export type Visibility = 'public' | 'class' | 'private';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type Language = 'ko' | 'en';
export type StampType = 'read' | 'hidden' | 'questions' | 'mystory';

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
  mystory_required_turns: number;
}

export interface Book {
  id: string;
  country_id: string;
  title: string;
  cover_url: string;
  pdf_url_ko: string | null;
  pdf_url_en: string | null;
  languages_available: Language[];
  character_analysis: BookCharacterAnalysis;
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
  // Legacy fields (kept for old stories)
  chat_log: Record<string, unknown>;
  all_student_messages: string | null;
  gauge_final: number;
  character_refs: CharacterRef[] | null;
  // New 7-step fields
  current_step: number;
  guide_answers: GuideAnswers | null;
  student_freewrite: string | null;
  ai_draft: AiDraftPage[] | null;
  final_text: string[] | null;
  uploaded_images: string[] | null;
  scene_descriptions: string[] | null;
  scene_images: string[] | null;
  character_designs: CharacterDesign[] | null;
  illustration_style: IllustrationStyle | null;
  cover_design: CoverDesign | null;
  cover_image_url: string | null;
  production_status: ProductionStatus;
  production_progress: number;
  // Shared fields
  translation_text: string[] | null;
  translated_texts: StoryTranslationMap | null;
  pdf_url_original: string | null;
  pdf_url_translated: string | null;
  translated_pdf_urls: StoryTranslatedPdfMap | null;
  visibility: Visibility;
  created_at: string;
}

export interface StoryReadProgress {
  id: string;
  story_id: string;
  user_id: string;
  last_page: number;
  total_pages_snapshot: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface StoryComment {
  id: string;
  story_id: string;
  user_id: string;
  content: string;
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

// ── Campaign System ──

export type CampaignStatus = 'draft' | 'active' | 'closed';
export type CampaignContentType = 'poster' | 'card_news' | 'impression' | 'culture_intro' | 'worksheet' | 'other';
export type SubmissionStatus = 'submitted' | 'featured' | 'hidden';

export interface CampaignAssetMeta {
  id: string;
  name: string;
  type: 'image' | 'pdf';
  size_bytes: number;
  storage_path: string;
  public_url: string;
}

export interface Campaign {
  id: string;
  title: string;
  description: string;
  cover_image_url: string | null;
  allowed_content_types: CampaignContentType[];
  tags: string[];
  status: CampaignStatus;
  deadline: string | null;
  max_files_per_submission: number;
  max_file_size_mb: number;
  created_by: string;
  class_id: string | null;
  scope: ContentScope;
  created_at: string;
  updated_at: string;
}

export interface CampaignSubmission {
  id: string;
  campaign_id: string;
  student_id: string;
  content_type: CampaignContentType;
  title: string;
  description: string | null;
  assets: CampaignAssetMeta[];
  status: SubmissionStatus;
  created_at: string;
}

export interface CampaignLike {
  id: string;
  submission_id: string;
  user_id: string;
  created_at: string;
}
