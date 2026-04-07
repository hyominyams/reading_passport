/* eslint-disable @next/next/no-img-element */
'use client';

import { motion } from 'framer-motion';

export interface LibraryStoryItem {
  id: string;
  story_id: string;
  country_id: string;
  book_id: string;
  likes: number;
  views: number;
  story: {
    id: string;
    student_id: string;
    book_id: string;
    country_id: string;
    language: string;
    story_type: string;
    custom_input: string | null;
    chat_log: Record<string, unknown>;
    all_student_messages: string | null;
    gauge_final: number;
    ai_draft: string[] | null;
    final_text: string[] | null;
    character_refs: { name: string; imageUrl: string }[] | null;
    scene_images: string[] | null;
    translation_text: string[] | null;
    pdf_url_original: string | null;
    pdf_url_translated: string | null;
    visibility: string;
    created_at: string;
  };
}

interface LibraryGridProps {
  items: LibraryStoryItem[];
  onItemClick: (item: LibraryStoryItem) => void;
  onLike?: (storyId: string) => void;
  likedStories?: Set<string>;
}

export default function LibraryGrid({
  items,
  onItemClick,
  onLike,
  likedStories = new Set(),
}: LibraryGridProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">📚</div>
        <h3 className="text-lg font-bold text-foreground mb-2">
          아직 이야기가 없어요
        </h3>
        <p className="text-sm text-muted">
          첫 번째 이야기를 만들어 보세요!
        </p>
      </div>
    );
  }

  return (
    <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4">
      {items.map((item, index) => {
        const coverImage =
          item.story.scene_images?.[0] || null;

        return (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="break-inside-avoid"
          >
            <button
              onClick={() => onItemClick(item)}
              className="w-full text-left bg-card rounded-xl border border-border overflow-hidden hover:shadow-md transition-all group"
            >
              {/* Cover image */}
              {coverImage ? (
                <div className="aspect-[4/3] overflow-hidden">
                  <img
                    src={coverImage}
                    alt="Story cover"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
                  <span className="text-4xl">📖</span>
                </div>
              )}

              {/* Info */}
              <div className="p-3">
                <p className="text-xs text-muted mb-1">
                  {item.country_id}
                </p>
                <p className="text-sm text-foreground line-clamp-2">
                  {item.story.final_text?.[0]?.slice(0, 50) || '이야기'}
                </p>

                {/* Likes */}
                <div className="flex items-center gap-3 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onLike?.(item.story_id);
                    }}
                    className={`flex items-center gap-1 text-xs ${
                      likedStories.has(item.story_id)
                        ? 'text-error'
                        : 'text-muted hover:text-error'
                    } transition-colors`}
                  >
                    <svg className="w-3.5 h-3.5" fill={likedStories.has(item.story_id) ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                    {item.likes}
                  </button>
                  <span className="text-xs text-muted">
                    조회 {item.views}
                  </span>
                </div>
              </div>
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
