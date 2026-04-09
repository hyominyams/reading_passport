import Header from '@/components/common/Header';
import { getBookById } from '@/lib/queries/books';
import ReadPageClient from '@/components/book/ReadPageClient';

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  const language = lang === 'en' ? 'en' : 'ko';

  const book = await getBookById(id);

  if (!book) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              책을 찾을 수 없습니다
            </h1>
            <p className="text-muted">요청하신 도서가 존재하지 않습니다.</p>
          </div>
        </main>
      </>
    );
  }

  const pdfUrl = language === 'en' ? book.pdf_url_en : book.pdf_url_ko;

  return (
    <>
      {/* Preload PDF.js so it's ready before client JS executes */}
      <link rel="modulepreload" href="/pdfjs/pdf.min.mjs" />
      <link rel="modulepreload" href="/pdfjs/pdf.worker.min.mjs" />
      <Header />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ReadPageClient book={book} pdfUrl={pdfUrl} language={language} />
      </main>
    </>
  );
}
