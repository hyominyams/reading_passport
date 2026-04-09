/* ─── Shared PDF.js loader ─── */

/* Minimal type subset used by components */
export interface PdfPage {
  getViewport(params: { scale: number }): { width: number; height: number };
  render(params: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}

export interface PdfDocument {
  numPages: number;
  getPage(num: number): Promise<PdfPage>;
  destroy(): Promise<void>;
}

export interface PdfJsLib {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(
    src: string | PdfDocumentInitParams,
  ): { promise: Promise<PdfDocument> };
}

export interface PdfDocumentInitParams {
  url: string;
  disableRange?: boolean;
  disableStream?: boolean;
  disableAutoFetch?: boolean;
  rangeChunkSize?: number;
}

/*
 * PDF.js is served from public/pdfjs/ (copied there by scripts/copy-pdfjs.mjs).
 * Falls back to jsDelivr CDN if local files are not available.
 */
const LOCAL_BASE = '/pdfjs';
const CDN_BASE = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/legacy/build';

let pdfjsPromise: Promise<PdfJsLib> | null = null;

export function getPdfJs(): Promise<PdfJsLib> {
  if (!pdfjsPromise) {
    pdfjsPromise = import(
      /* webpackIgnore: true */ `${LOCAL_BASE}/pdf.min.mjs`
    )
      .then((mod: PdfJsLib) => {
        mod.GlobalWorkerOptions.workerSrc = `${LOCAL_BASE}/pdf.worker.min.mjs`;
        return mod;
      })
      .catch(() => {
        // Fallback to CDN if local files aren't available
        return import(
          /* webpackIgnore: true */ `${CDN_BASE}/pdf.min.mjs`
        ).then((mod: PdfJsLib) => {
          mod.GlobalWorkerOptions.workerSrc = `${CDN_BASE}/pdf.worker.min.mjs`;
          return mod;
        });
      });
  }
  return pdfjsPromise;
}

/**
 * Creates getDocument options with range request and streaming enabled.
 * Range requests allow the first page to render before the full PDF downloads.
 */
export function createLoadParams(url: string): PdfDocumentInitParams {
  return {
    url,
    disableRange: false,
    disableStream: false,
    disableAutoFetch: false,
    rangeChunkSize: 65536, // 64KB chunks
  };
}
