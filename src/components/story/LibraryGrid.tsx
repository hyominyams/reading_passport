/* eslint-disable @next/next/no-img-element */
'use client';

import { useState } from 'react';
import BookshelfRow from './BookshelfRow';
import { countries } from '@/lib/data/countries';

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
    author?: { nickname: string | null };
  };
}

interface LibraryGridProps {
  itemsByCountry: Record<string, LibraryStoryItem[]>;
  onItemClick: (item: LibraryStoryItem) => void;
  onLike?: (storyId: string) => void;
  likedStories?: Set<string>;
}

export default function LibraryGrid({
  itemsByCountry,
  onItemClick,
  onLike,
  likedStories = new Set(),
}: LibraryGridProps) {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const countryIds = Object.keys(itemsByCountry);

  if (countryIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-32 h-24 mb-6 relative">
          {/* Empty bookshelf illustration */}
          <div className="absolute bottom-0 w-full h-3 bg-gradient-to-r from-[#8B7355] via-[#A08760] to-[#8B7355] rounded shadow-md" />
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-4xl opacity-40">
            📚
          </div>
        </div>
        <h3 className="text-lg font-heading text-foreground mb-2">
          아직 이야기가 없어요
        </h3>
        <p className="text-sm text-muted">
          첫 번째 이야기를 만들어 보세요!
        </p>
      </div>
    );
  }

  // Auto-expand if there's only one country
  const effectiveExpanded = countryIds.length === 1 ? countryIds[0] : expandedCountry;

  return (
    <div className="space-y-2">
      {countryIds.map((countryId) => {
        const countryData = countries.find((c) => c.id === countryId);
        return (
          <BookshelfRow
            key={countryId}
            countryId={countryId}
            countryName={countryData?.name ?? countryId}
            countryFlag={countryData?.flag ?? '🌍'}
            items={itemsByCountry[countryId]}
            isExpanded={effectiveExpanded === countryId}
            onToggle={() =>
              setExpandedCountry((prev) => (prev === countryId ? null : countryId))
            }
            onItemClick={onItemClick}
            onLike={(storyId) => onLike?.(storyId)}
            likedStories={likedStories}
          />
        );
      })}
    </div>
  );
}
