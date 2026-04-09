import { createRequire } from 'node:module';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { pickPreferredPdfUrl } from '@/lib/pdf-analysis';
import { storeGeneratedImageBuffer } from '@/lib/storage/generated-images';

const COVER_MIME_TYPE = 'image/png';
const TARGET_COVER_WIDTH = 480;
const require = createRequire(import.meta.url);

function getCanvasModule() {
  return require('@napi-rs/canvas') as typeof import('@napi-rs/canvas');
}

function resolvePdfUrl(pdfUrl: string, baseUrl?: string) {
  if (/^https?:\/\//i.test(pdfUrl)) {
    return pdfUrl;
  }

  if (!baseUrl) {
    throw new Error('상대 경로 PDF를 해석하려면 baseUrl이 필요합니다');
  }

  return new URL(pdfUrl, baseUrl).toString();
}

async function renderPdfFirstPage(pdfUrl: string, baseUrl?: string) {
  const resolvedUrl = resolvePdfUrl(pdfUrl, baseUrl);
  const response = await fetch(resolvedUrl);

  if (!response.ok) {
    throw new Error(`PDF 다운로드에 실패했습니다: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  });
  const document = await loadingTask.promise;

  try {
    const page = await document.getPage(1);

    const baseViewport = page.getViewport({ scale: 1 });
    const scale = TARGET_COVER_WIDTH / baseViewport.width;
    const viewport = page.getViewport({ scale });

    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    const { createCanvas } = getCanvasModule();
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d') as unknown as CanvasRenderingContext2D;

    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context,
      viewport,
    }).promise;

    return canvas.toBuffer(COVER_MIME_TYPE);
  } finally {
    await loadingTask.destroy();
  }
}

export async function generateAndStoreBookCover(options: {
  bookId: string;
  pdfUrlKo?: string | null;
  pdfUrlEn?: string | null;
  baseUrl?: string;
}) {
  const pdfUrl = pickPreferredPdfUrl(options.pdfUrlKo, options.pdfUrlEn);

  if (!pdfUrl) {
    return null;
  }

  const imageBuffer = await renderPdfFirstPage(pdfUrl, options.baseUrl);

  return storeGeneratedImageBuffer({
    fileBuffer: imageBuffer,
    mimeType: COVER_MIME_TYPE,
    folder: `book-covers/${options.bookId}`,
  });
}
