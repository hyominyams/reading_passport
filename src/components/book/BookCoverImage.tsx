'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';
import dynamic from 'next/dynamic';

const PdfCoverThumbnail = dynamic(() => import('./PdfCoverThumbnail'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#fffdf8] to-[#f6eee0]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d9c7ae] border-t-[#8c5d35]" />
    </div>
  ),
});

interface BookCoverImageProps {
  title: string;
  coverUrl?: string | null;
  sizes: string;
  imageClassName?: string;
  fallbackClassName?: string;
  iconClassName?: string;
}

function isPdfUrl(url?: string | null): boolean {
  if (!url) {
    return false;
  }

  return url.trim().split('?')[0].toLowerCase().endsWith('.pdf');
}

function isImageUrl(url?: string | null): boolean {
  return !!url && !isPdfUrl(url);
}

export default function BookCoverImage({
  title,
  coverUrl,
  sizes,
  imageClassName = 'object-cover',
  fallbackClassName = 'flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200',
  iconClassName = 'h-6 w-6 text-slate-400',
}: BookCoverImageProps) {
  const normalizedCoverUrl = coverUrl?.trim() || null;
  const [hasImageError, setHasImageError] = useState(false);
  const showImage = isImageUrl(normalizedCoverUrl) && !hasImageError;
  const showPdfPlaceholder = isPdfUrl(normalizedCoverUrl);

  if (showImage) {
    return (
      <div className="relative h-full w-full">
        <img
          src={normalizedCoverUrl!}
          alt={title}
          sizes={sizes}
          className={`absolute inset-0 h-full w-full ${imageClassName}`}
          loading="lazy"
          decoding="async"
          onError={() => setHasImageError(true)}
        />
      </div>
    );
  }

  if (showPdfPlaceholder) {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[inherit]">
        <PdfCoverThumbnail
          pdfUrl={normalizedCoverUrl!}
          className="h-full w-full [&_canvas]:!h-full [&_canvas]:object-cover"
        />
      </div>
    );
  }

  return (
    <div className={fallbackClassName}>
      <div className="flex flex-col items-center gap-1 text-center">
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
        <span className="text-[10px] font-medium text-muted">표지 오류</span>
      </div>
    </div>
  );
}
