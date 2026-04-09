import type { PdfDocument } from './pdfjs-loader';

const MAX_CACHE_SIZE = 3;
const cache = new Map<string, PdfDocument>();

export function getCachedDocument(url: string): PdfDocument | undefined {
  return cache.get(url);
}

export function setCachedDocument(url: string, doc: PdfDocument): void {
  // Evict oldest entry if at capacity
  if (cache.size >= MAX_CACHE_SIZE && !cache.has(url)) {
    const oldest = cache.keys().next().value;
    if (oldest) {
      cache.get(oldest)?.destroy();
      cache.delete(oldest);
    }
  }
  cache.set(url, doc);
}
