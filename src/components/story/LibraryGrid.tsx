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
  book?: {
    id: string;
    title?: string | null;
    cover_url?: string | null;
  } | null;
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

export interface LibraryBookShelf {
  bookId: string;
  bookTitle: string;
  bookCoverUrl?: string | null;
  items: LibraryStoryItem[];
}

export interface LibraryCountryShelf {
  countryId: string;
  countryName: string;
  countryFlag: string;
  books: LibraryBookShelf[];
}

interface LibraryGridProps {
  itemsByCountry?: Record<string, LibraryStoryItem[]>;
  countryShelves?: LibraryCountryShelf[];
  onItemClick: (item: LibraryStoryItem) => void;
  onLike?: (storyId: string) => void;
  likedStories?: Set<string>;
}

function buildCountryShelves(
  itemsByCountry: Record<string, LibraryStoryItem[]>
): LibraryCountryShelf[] {
  return Object.entries(itemsByCountry).map(([countryId, items]) => {
    const countryData = countries.find((c) => c.id === countryId);
    const bookGroups = new Map<string, LibraryBookShelf>();

    for (const item of items) {
      const bookId = item.book?.id ?? item.story.book_id ?? item.book_id;
      const existing = bookGroups.get(bookId);
      const bookTitle =
        item.book?.title?.trim() ||
        `원작 책 ${bookGroups.size + 1}`;
      const bookCoverUrl = item.book?.cover_url ?? null;

      if (existing) {
        existing.items.push(item);
      } else {
        bookGroups.set(bookId, {
          bookId,
          bookTitle,
          bookCoverUrl,
          items: [item],
        });
      }
    }

    const books = Array.from(bookGroups.values()).map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => b.likes - a.likes),
    }));

    return {
      countryId,
      countryName: countryData?.name ?? countryId,
      countryFlag: countryData?.flag ?? '🌍',
      books,
    };
  });
}

export default function LibraryGrid({
  itemsByCountry = {},
  countryShelves,
  onItemClick,
  onLike,
  likedStories = new Set(),
}: LibraryGridProps) {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  const shelves = countryShelves ?? buildCountryShelves(itemsByCountry);

  if (shelves.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-32 h-24 mb-6 relative">
          {/* Empty bookshelf illustration */}
          <div className="absolute bottom-0 w-full h-3 bg-gradient-to-r from-[#4f5b73] via-[#64748b] to-[#4f5b73] rounded shadow-md" />
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
  const effectiveExpanded = shelves.length === 1 ? shelves[0].countryId : expandedCountry;

  return (
    <div className="space-y-2">
      {shelves.map((shelf) => (
        <BookshelfRow
          key={shelf.countryId}
          countryId={shelf.countryId}
          countryName={shelf.countryName}
          countryFlag={shelf.countryFlag}
          bookShelves={shelf.books}
          isExpanded={effectiveExpanded === shelf.countryId}
          onToggle={() =>
            setExpandedCountry((prev) => (prev === shelf.countryId ? null : shelf.countryId))
          }
          onItemClick={onItemClick}
          onLike={(storyId) => onLike?.(storyId)}
          likedStories={likedStories}
        />
      ))}
    </div>
  );
}
