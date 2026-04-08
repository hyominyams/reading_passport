/* eslint-disable @next/next/no-img-element */
'use client';

import ShelfBook from './ShelfBook';
import type { LibraryBookShelf, LibraryStoryItem } from './LibraryGrid';

interface BookShelfProps {
  shelf: LibraryBookShelf;
  shelfIndex: number;
  onItemClick: (item: LibraryStoryItem) => void;
  onLike: (storyId: string) => void;
  likedStories: Set<string>;
}

export default function BookShelf({
  shelf,
  shelfIndex,
  onItemClick,
  onLike,
  likedStories,
}: BookShelfProps) {
  return (
    <div className="mb-2">
      {/* Book title label above shelf */}
      <div className="flex items-center gap-2 mb-2 px-1">
        {shelf.bookCoverUrl && (
          <div
            className="w-6 h-8 rounded-sm bg-cover bg-center flex-shrink-0 border border-border/40"
            style={{ backgroundImage: `url(${shelf.bookCoverUrl})` }}
          />
        )}
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted">
            원작 책
          </p>
          <p className="text-xs font-heading text-foreground truncate">
            {shelf.bookTitle || `원작 책 ${shelfIndex + 1}`}
          </p>
        </div>
        <span className="text-[10px] text-muted ml-auto flex-shrink-0">
          {shelf.items.length}편
        </span>
      </div>

      {/* Books standing on shelf */}
      <div className="relative">
        {/* Books row */}
        <div className="flex gap-3 sm:gap-4 px-4 pb-0 overflow-x-auto lg:flex-wrap scrollbar-hide">
          {shelf.items.map((item, index) => (
            <ShelfBook
              key={item.id}
              item={item}
              index={index}
              isLiked={likedStories.has(item.story_id)}
              onItemClick={onItemClick}
              onLike={onLike}
              bookCoverUrl={shelf.bookCoverUrl}
            />
          ))}
        </div>

        {/* Wooden shelf plank */}
        <div className="mt-1">
          {/* Top edge highlight */}
          <div className="h-[6px] shelf-plank-edge rounded-t-sm mx-0.5" />
          {/* Front face */}
          <div className="h-[14px] shelf-plank rounded-b-sm" />
          {/* Bottom shadow */}
          <div className="h-2 bg-gradient-to-b from-black/10 to-transparent mx-1" />
        </div>
      </div>
    </div>
  );
}
