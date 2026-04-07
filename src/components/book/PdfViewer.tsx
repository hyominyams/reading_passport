'use client';

import { useState, useCallback, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { motion, AnimatePresence } from 'framer-motion';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfViewerProps {
  pdfUrl: string;
  onLastPage: () => void;
}

export default function PdfViewer({ pdfUrl, onLastPage }: PdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [direction, setDirection] = useState(0);
  const [loading, setLoading] = useState(true);
  const [pageWidth, setPageWidth] = useState(600);

  useEffect(() => {
    const updateWidth = () => {
      setPageWidth(Math.min(600, window.innerWidth - 64));
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages: total }: { numPages: number }) => {
      setNumPages(total);
      setLoading(false);
    },
    []
  );

  const goToPrev = () => {
    if (currentPage > 1) {
      setDirection(-1);
      setCurrentPage((p) => p - 1);
    }
  };

  const goToNext = () => {
    if (currentPage < numPages) {
      setDirection(1);
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      if (nextPage === numPages) {
        onLastPage();
      }
    }
  };

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -300 : 300,
      opacity: 0,
    }),
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* PDF viewer */}
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-md overflow-hidden"
           style={{ minHeight: '500px' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted-light">
            <div className="w-8 h-8 border-3 border-muted-light border-t-primary rounded-full animate-spin" />
          </div>
        )}

        <Document
          file={pdfUrl}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={(err) => console.error('PDF load error:', err)}
          loading={null}
          className="flex justify-center"
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentPage}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              <Page
                pageNumber={currentPage}
                width={pageWidth}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </motion.div>
          </AnimatePresence>
        </Document>
      </div>

      {/* Navigation */}
      <div className="flex items-center gap-6">
        <button
          onClick={goToPrev}
          disabled={currentPage <= 1}
          className="flex items-center justify-center w-12 h-12 rounded-full
                     bg-card border border-border shadow-sm
                     hover:bg-card-hover disabled:opacity-30
                     transition-all text-xl"
          aria-label="이전 페이지"
        >
          &#8592;
        </button>

        <span className="text-sm text-muted font-medium min-w-[80px] text-center">
          {currentPage} / {numPages || '...'}
        </span>

        <button
          onClick={goToNext}
          disabled={currentPage >= numPages}
          className="flex items-center justify-center w-12 h-12 rounded-full
                     bg-card border border-border shadow-sm
                     hover:bg-card-hover disabled:opacity-30
                     transition-all text-xl"
          aria-label="다음 페이지"
        >
          &#8594;
        </button>
      </div>
    </div>
  );
}
