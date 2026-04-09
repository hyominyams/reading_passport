'use client';

import { useEffect, useRef, useState } from 'react';
import { getPdfJs, createLoadParams } from '@/lib/pdfjs-loader';

interface PdfCoverThumbnailProps {
  pdfUrl: string;
  title?: string;
  width?: number;
  className?: string;
}

export default function PdfCoverThumbnail({
  pdfUrl,
  title,
  className = '',
}: PdfCoverThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const pdfjsLib = await getPdfJs();
        const loadingTask = pdfjsLib.getDocument(createLoadParams(pdfUrl));
        const doc = await loadingTask.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }

        const page = await doc.getPage(1);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) {
          await doc.destroy();
          return;
        }

        const containerWidth = canvas.parentElement?.clientWidth || 280;
        const dpr = window.devicePixelRatio || 1;
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = (containerWidth * dpr) / baseViewport.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';

        const ctx = canvas.getContext('2d');
        if (!ctx || cancelled) {
          await doc.destroy();
          return;
        }

        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        await doc.destroy();

        if (!cancelled) setLoaded(true);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  /* Fallback: show styled placeholder on error */
  if (error) {
    const badge = title?.trim()?.slice(0, 1).toUpperCase() || 'PDF';
    return (
      <div
        className={`relative flex h-full w-full overflow-hidden rounded-[inherit] bg-[linear-gradient(160deg,#f8efe0_0%,#ead5b8_100%)] ${className}`}
      >
        <div className="absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-[#5b3a1f]/25 to-transparent" />
        <div className="relative flex h-full w-full flex-col justify-between p-3 text-[#6c4a2a]">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#b88d63]/50 bg-white/70 text-xs font-bold shadow-sm">
            {badge}
          </div>
          <p className="line-clamp-3 text-xs font-semibold leading-snug">
            {title || '그림책'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-[inherit] bg-[#faf6ef] ${className}`}
    >
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#e8dcc8] border-t-[#8c5d35]" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={`w-full transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
}
