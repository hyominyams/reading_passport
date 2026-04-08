'use client';

/* eslint-disable @next/next/no-img-element */

import { useState } from 'react';

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
      <div className="relative h-full w-full overflow-hidden rounded-[inherit] border border-slate-200 bg-[linear-gradient(160deg,#fffdf8_0%,#f6eee0_52%,#ead9bc_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_48%)]" />
        <div className="absolute right-2 top-2 rounded-full bg-white/85 px-2 py-0.5 text-[9px] font-semibold tracking-[0.18em] text-slate-600 shadow-sm">
          PDF
        </div>
        <div className="relative flex h-full flex-col justify-between p-3">
          <div className="text-[9px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            World Stories
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-slate-700">
              <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H6.375A1.125 1.125 0 005.25 3.375v17.25a1.125 1.125 0 001.125 1.125h11.25a1.125 1.125 0 001.125-1.125V10.5a9 9 0 00-9-9z" />
              </svg>
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-slate-600">
                Book File
              </span>
            </div>
            <p
              className="text-xs font-semibold leading-snug text-slate-900"
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 4,
                overflow: 'hidden',
              }}
            >
              {title}
            </p>
            <p className="text-[10px] leading-snug text-slate-600">
              PDF 표지를 이미지로 변환하지 못할 때 문서형 표지로 표시합니다.
            </p>
          </div>
        </div>
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
