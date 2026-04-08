'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';

interface PdfViewerProps {
  pdfUrl: string;
  onLastPage: () => void;
}

export default function PdfViewer({ pdfUrl, onLastPage }: PdfViewerProps) {
  const viewerUrl = useMemo(() => {
    const separator = pdfUrl.includes('#') ? '&' : '#';
    return `${pdfUrl}${separator}toolbar=1&navpanes=0&scrollbar=1&view=FitH`;
  }, [pdfUrl]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <div className="overflow-hidden rounded-[28px] border border-[#d9c7ae] bg-[linear-gradient(180deg,#fbf6ec_0%,#efe1ca_100%)] p-3 shadow-[0_28px_90px_rgba(94,63,34,0.16)] sm:p-4">
        <div className="overflow-hidden rounded-[22px] border border-[#e7d7c1] bg-white shadow-inner">
          <iframe
            src={viewerUrl}
            title="책 PDF 뷰어"
            className="h-[70vh] min-h-[520px] w-full bg-white"
          />
        </div>
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#eadcca] bg-white/90 px-5 py-4 text-center shadow-sm sm:flex-row sm:text-left">
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#7d6243]">
            브라우저 내장 PDF 뷰어로 읽고 있어요
          </p>
          <p className="mt-1 text-xs text-[#8f7759]">
            기기에서 PDF가 바로 보이지 않으면 새 탭으로 연 뒤 읽기 완료를 눌러주세요.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center rounded-full border border-[#d8c5a8] bg-white px-4 py-2 text-sm font-semibold text-[#7d6243] transition hover:-translate-y-0.5 hover:bg-[#fffaf1]"
          >
            새 탭으로 열기
          </a>
          <motion.button
            type="button"
            onClick={onLastPage}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center justify-center rounded-full bg-[#8c5d35] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#7b512d]"
          >
            읽기 완료
          </motion.button>
        </div>
      </div>
    </div>
  );
}
