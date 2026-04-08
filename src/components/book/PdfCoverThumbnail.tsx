'use client';

import '@/lib/pdf-worker-setup';
import { useState } from 'react';
import { Document, Thumbnail } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface PdfCoverThumbnailProps {
  pdfUrl: string;
  width?: number;
  className?: string;
}

export default function PdfCoverThumbnail({
  pdfUrl,
  width,
  className = '',
}: PdfCoverThumbnailProps) {
  const [error, setError] = useState(false);

  if (error) {
    return null;
  }

  return (
    <div className={`storybook-page ${className}`}>
      <Document
        file={pdfUrl}
        loading={
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#fffdf8] to-[#f6eee0]">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#d9c7ae] border-t-[#8c5d35]" />
          </div>
        }
        error=""
        onLoadError={() => setError(true)}
      >
        <Thumbnail
          pageNumber={1}
          width={width}
          className="[&_canvas]:!h-auto [&_canvas]:!w-full"
        />
      </Document>
    </div>
  );
}
