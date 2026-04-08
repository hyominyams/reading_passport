'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react';
import { getPdfJs } from '@/lib/pdf-client';

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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hasImageError, setHasImageError] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [pdfThumbnailUrl, setPdfThumbnailUrl] = useState<string | null>(null);
  const [hasPdfError, setHasPdfError] = useState(false);
  const showImage = isImageUrl(normalizedCoverUrl) && !hasImageError;
  const showPdf = isPdfUrl(normalizedCoverUrl) && !hasPdfError;

  useEffect(() => {
    const node = containerRef.current;

    if (!node) {
      return;
    }

    const updateWidth = () => {
      const nextWidth = Math.round(node.clientWidth);
      setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth));
    };

    updateWidth();

    const observer = new ResizeObserver(() => {
      updateWidth();
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    setHasImageError(false);
    setPdfThumbnailUrl(null);
    setHasPdfError(false);
  }, [normalizedCoverUrl]);

  useEffect(() => {
    if (!showPdf || !normalizedCoverUrl || containerWidth <= 0) {
      return;
    }

    let cancelled = false;
    let loadingTask: ReturnType<ReturnType<typeof getPdfJs>['getDocument']> | null = null;

    const renderPdfThumbnail = async () => {
      try {
        const pdfjs = getPdfJs();

        loadingTask = pdfjs.getDocument(normalizedCoverUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 1 });
        const scale = containerWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Canvas context unavailable');
        }

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(scaledViewport.width * outputScale);
        canvas.height = Math.ceil(scaledViewport.height * outputScale);
        canvas.style.width = `${scaledViewport.width}px`;
        canvas.style.height = `${scaledViewport.height}px`;

        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);
        context.imageSmoothingEnabled = true;

        await page.render({
          canvas: null,
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (!cancelled) {
          setPdfThumbnailUrl(canvas.toDataURL('image/png'));
        }

        page.cleanup();
        pdf.cleanup();
        await pdf.destroy();
      } catch (error) {
        if (!cancelled) {
          console.error('PDF thumbnail render error:', error);
          setHasPdfError(true);
        }
      }
    };

    renderPdfThumbnail();

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
    };
  }, [containerWidth, normalizedCoverUrl, showPdf]);

  if (showImage) {
    return (
      <div ref={containerRef} className="relative h-full w-full">
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

  if (showPdf) {
    return (
      <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-white">
        {pdfThumbnailUrl ? (
          <img
            src={pdfThumbnailUrl}
            alt={`${title} 표지`}
            sizes={sizes}
            className={`absolute inset-0 h-full w-full ${imageClassName}`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={fallbackClassName}>
            <div className="flex flex-col items-center gap-1 text-center">
              <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H6.375A1.125 1.125 0 005.25 3.375v17.25a1.125 1.125 0 001.125 1.125h11.25a1.125 1.125 0 001.125-1.125V10.5a9 9 0 00-9-9z" />
              </svg>
              <span className="text-[10px] font-medium text-muted">표지 1페이지 로딩 중</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className={fallbackClassName}>
      <div className="flex flex-col items-center gap-1 text-center">
        <svg className={iconClassName} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
        <span className="text-[10px] font-medium text-muted">표지 오류</span>
      </div>
    </div>
  );
}
