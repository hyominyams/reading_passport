type PdfJsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

function resolvePdfUrl(pdfUrl: string, baseUrl: string) {
  return new URL(pdfUrl, baseUrl).toString();
}

async function loadPdfJs() {
  return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as PdfJsModule;
}

export function pickPreferredPdfUrl(
  pdfUrlKo?: string | null,
  pdfUrlEn?: string | null
) {
  const ko = pdfUrlKo?.trim();
  if (ko) return ko;

  const en = pdfUrlEn?.trim();
  if (en) return en;

  return null;
}

export async function extractPdfTextFromUrl(
  pdfUrl: string,
  baseUrl: string,
  maxPages = 50
): Promise<string> {
  const resolvedUrl = resolvePdfUrl(pdfUrl, baseUrl);
  const response = await fetch(resolvedUrl);

  if (!response.ok) {
    throw new Error(`PDF 다운로드에 실패했습니다: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  const { getDocument } = await loadPdfJs();
  const document = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pageCount = Math.min(document.numPages, maxPages);
  const chunks: string[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (pageText) {
      chunks.push(pageText);
    }
  }

  return chunks.join('\n\n').trim();
}

export async function extractPreferredPdfText(
  pdfUrlKo?: string | null,
  pdfUrlEn?: string | null,
  baseUrl?: string,
  maxPages = 50
): Promise<string> {
  if (!baseUrl) return '';

  const pdfUrl = pickPreferredPdfUrl(pdfUrlKo, pdfUrlEn);
  if (!pdfUrl) return '';

  return extractPdfTextFromUrl(pdfUrl, baseUrl, maxPages);
}
