'use client';

import { pdfjs } from 'react-pdf';

let workerConfigured = false;

export function getPdfJs() {
  if (!workerConfigured) {
    pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    workerConfigured = true;
  }

  return pdfjs;
}
