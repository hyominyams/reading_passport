'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import ConfettiAnimation from '@/components/story/ConfettiAnimation';
import BookPreview from '@/components/story/BookPreview';
import { createClient } from '@/lib/supabase/client';
import type { Story } from '@/types/database';
import { getDetailStepProgressLabel, getStepRouteWithLang } from '@/lib/mystory-steps';
import { normalizePictureBookShape, getPictureBookShapeOption } from '@/lib/picture-book-shapes';
import {
  getTranslationLanguageLabel,
  normalizeTranslatedTextsMap,
} from '@/lib/story-translations';
import {
  generateSingleFontFaceCSS,
  getCoverTypographyFont,
  normalizeStorybookFontSize,
} from '@/lib/storybook-fonts';

function formatCompletedDate(value: string | null | undefined) {
  if (!value) return '날짜 정보 없음';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '날짜 정보 없음';

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return char;
    }
  });
}

function waitForPrintImages(documentRef: Document) {
  const images = Array.from(documentRef.images);

  return Promise.all(
    images.map((image) => {
      if (image.complete) return Promise.resolve();

      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true });
        image.addEventListener('error', () => resolve(), { once: true });
      });
    }),
  );
}

export default function CompletePageContent({ storyId }: { storyId: string | null }) {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [completed, setCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);

  useEffect(() => {
    const fetchStory = async () => {
      if (!storyId) {
        setLoading(false);
        return;
      }

      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('stories')
          .select('*')
          .eq('id', storyId)
          .single();

        if (data) {
          setStory(data as Story);
        }
      } finally {
        setLoading(false);
      }
    };

    void fetchStory();
  }, [storyId]);

  const translatedTexts = useMemo(
    () => normalizeTranslatedTextsMap(story?.translated_texts, story?.translation_text, story?.language),
    [story?.translated_texts, story?.translation_text, story?.language]
  );

  const translatedEntries = useMemo(
    () => Object.entries(translatedTexts).filter(([, pages]) => pages.length > 0),
    [translatedTexts]
  );

  const coverImage = story?.cover_image_url ?? story?.cover_design?.image_url ?? undefined;
  const coverTitle = story?.cover_design?.title ?? '나의 이야기';
  const coverAuthor = story?.cover_design?.author ?? '';
  const pictureBookShape = normalizePictureBookShape(story?.cover_design?.picture_book_shape);
  const shapeOption = getPictureBookShapeOption(pictureBookShape);
  const cssAspectRatio = shapeOption.aspectRatio.replace(':', '/');
  const storyFont = getCoverTypographyFont(story?.cover_design, story?.illustration_style);
  const storyFontSize = normalizeStorybookFontSize(story?.cover_design?.story_font_size);
  const isHistoryView = story?.story_status === 'completed';
  const completedDateLabel = formatCompletedDate(story?.completed_at ?? story?.created_at);

  const getPageImage = (index: number): string | null => {
    if (!story) return null;
    const uploaded = story.uploaded_images?.[index];
    if (uploaded) return uploaded;
    const generated = story.scene_images?.[index];
    if (generated) return generated;
    return null;
  };

  const handleStepSelect = async (targetStep: number) => {
    if (!storyId || !story || isHistoryView) return;

    setSaving(true);
    setSaveError(null);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('stories')
        .update({ current_step: Math.max(story.current_step, targetStep) })
        .eq('id', storyId);

      if (error) {
        throw error;
      }

      router.push(getStepRouteWithLang(bookId, targetStep, storyId, story.language));
    } catch (error) {
      console.error('Step move error:', error);
      setSaveError('단계를 이동하지 못했어요.');
      setSaving(false);
    }
  };

  const handleDownloadPdf = (languageCode?: string) => {
    if (!story?.final_text?.length) return;

    const pages = languageCode ? translatedTexts[languageCode] ?? story.final_text : story.final_text;
    const title = languageCode
      ? `${coverTitle} (${getTranslationLanguageLabel(languageCode)})`
      : coverTitle;
    const printFontFamily = `'${storyFont.fontFamily}', 'Noto Sans KR', sans-serif`;
    const fontFaceCSS = generateSingleFontFaceCSS(storyFont, window.location.origin);

    const bookPages: string[] = [];

    bookPages.push(`
      <div class="book-page cover-page page-break">
        ${coverImage
          ? `<img src="${escapeHtml(coverImage)}" alt="Cover" class="cover-img" />`
          : `<div class="cover-text-only">
               <h1 class="cover-title">${escapeHtml(title)}</h1>
               <p class="cover-author">${escapeHtml(coverAuthor)}</p>
             </div>`
        }
      </div>
    `);

    pages.forEach((text, index) => {
      const image = getPageImage(index);

      if (image) {
        bookPages.push(`
          <div class="book-page image-page page-break">
            <img src="${escapeHtml(image)}" alt="Scene ${index + 1}" class="scene-img" />
          </div>
        `);
      }

      bookPages.push(`
        <div class="book-page text-page ${index < pages.length - 1 || image ? 'page-break' : ''}">
          <div class="text-wrapper">
            <p class="story-text">${escapeHtml(text ?? '').replace(/\n/g, '<br/>')}</p>
          </div>
        </div>
      `);
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(title)}</title>
        <style>
          ${fontFaceCSS}
          @page { margin: 0; size: A4; }
          @media print {
            body { margin: 0; }
            .page-break { page-break-after: always; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: ${printFontFamily}; }
          .book-page {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            aspect-ratio: ${cssAspectRatio};
          }
          .cover-page { background: #fafafa; }
          .cover-img { max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px; }
          .cover-text-only { text-align: center; }
          .cover-title { font-size: 36px; color: #2563eb; margin-bottom: 12px; }
          .cover-author { font-size: 18px; color: #666; }
          .image-page { background: #fff; }
          .scene-img { max-width: 92%; max-height: 92%; object-fit: contain; border-radius: 4px; }
          .text-page { background: #fff; padding: 60px; }
          .text-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
            transform: translateY(-4%);
          }
          .story-text {
            font-family: ${printFontFamily};
            font-size: ${storyFontSize}px;
            line-height: 2;
            text-align: center;
            color: #222;
            max-width: 700px;
            word-break: keep-all;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        ${bookPages.join('')}
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let didPrint = false;
      const printWhenReady = async () => {
        if (didPrint) return;
        didPrint = true;

        try {
          await Promise.all([
            printWindow.document.fonts?.ready ?? Promise.resolve(),
            waitForPrintImages(printWindow.document),
          ]);
        } finally {
          printWindow.focus();
          printWindow.print();
        }
      };

      printWindow.document.open();
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.addEventListener('load', () => {
        void printWhenReady();
      }, { once: true });
      window.setTimeout(() => {
        void printWhenReady();
      }, 500);
    }
  };

  const handlePublish = async () => {
    if (!storyId || !story) return;
    setSaving(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/story/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        completedAt?: string;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || '도서관에 공유하지 못했어요.');
      }

      const completedAt = data.completedAt ?? new Date().toISOString();
      setStory((prev) => (
        prev
          ? {
            ...prev,
            story_status: 'completed',
            completed_at: completedAt,
            current_step: Math.max(prev.current_step, 8),
          }
          : prev
      ));
      setCompleted(true);
      setShowConfetti(true);
    } catch (error) {
      console.error('Publish error:', error);
      setSaveError('도서관에 공유하지 못했어요. 다시 시도해 주세요.');
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story || !story.final_text?.length) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">완성된 이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  return (
    <>
      <ConfettiAnimation show={showConfetti} />
      {!isHistoryView && (
        <MyStoryStepSidebar currentStep={8} busy={saving} onStepSelect={handleStepSelect} />
      )}
      <main className="flex-1 px-4 py-6 max-w-5xl mx-auto xl:ml-auto xl:mr-[25rem]">
        {completed ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-green-200 bg-green-50 px-6 py-10 text-center"
          >
            <div className="text-5xl">🎉</div>
            <h1 className="mt-4 text-3xl font-bold text-gray-900">도서관 공유가 완료되었어요</h1>
            <p className="mt-2 text-gray-600">한국어 원본이 기본 공유본으로 등록되었고, 번역본도 함께 보관됩니다.</p>
            <div className="mt-8 flex justify-center gap-3">
              <a href="/library" className="rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 transition-colors">
                도서관 보기
              </a>
              <a href={`/book/${bookId}`} className="rounded-xl bg-white px-6 py-3 font-medium text-gray-800 border border-gray-200 hover:bg-gray-50 transition-colors">
                책으로 돌아가기
              </a>
            </div>
          </motion.div>
        ) : (
          <>
            {isHistoryView && (
              <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 sm:px-5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
                  완성본 보관 이력
                </p>
                <h2 className="mt-2 text-lg font-bold text-amber-900">
                  {completedDateLabel}에 완성한 버전입니다
                </h2>
                <p className="mt-1 text-sm text-amber-800">
                  이 화면은 읽기 전용입니다. 내용을 바꾸려면 My World 첫 화면에서 새 버전을 시작해 주세요.
                </p>
              </div>
            )}

            <div className="mb-6">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                  {getDetailStepProgressLabel(8)}
                </span>
                <span>완성하기</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">책과 번역본을 최종 점검하세요</h1>
              <p className="text-gray-500 mt-1">
                한국어 원본은 책처럼 확인하고, 번역본은 언어별 다운로드 상태를 점검한 뒤 공유할 수 있어요.
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
              <h2 className="mb-4 text-sm font-semibold text-gray-600">한국어 원본 책 확인</h2>
              <BookPreview
                pages={story.final_text}
                sceneImages={story.scene_images ?? []}
                coverImage={coverImage}
                title={coverTitle}
                storyFontFamily={storyFont.fontFamily}
                storyFontSize={storyFontSize}
              />
            </div>

            <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-600">번역본 점검</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    번역본은 책처럼 미리보기 없이 언어별 PDF로 제공합니다.
                  </p>
                </div>
                {!isHistoryView && (
                  <button
                    onClick={() => {
                      if (!storyId) return;
                      router.push(getStepRouteWithLang(bookId, 7, storyId, story.language));
                    }}
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    그림책 제작으로 돌아가기
                  </button>
                )}
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">한국어 원본</p>
                    <p className="text-xs text-gray-500">기본 공유본으로 등록됩니다.</p>
                  </div>
                  <button
                    onClick={() => handleDownloadPdf()}
                    className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    PDF 다운로드
                  </button>
                </div>

                {translatedEntries.length > 0 ? (
                  translatedEntries.map(([languageCode, pages]) => (
                    <div
                      key={languageCode}
                      className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {getTranslationLanguageLabel(languageCode)}
                        </p>
                        <p className="text-xs text-gray-500">{pages.length}페이지 번역 완료</p>
                      </div>
                      <button
                        onClick={() => handleDownloadPdf(languageCode)}
                        className="rounded-xl bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        PDF 다운로드
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5 text-sm text-gray-500">
                    아직 추가된 번역본이 없습니다. 그림책 제작 단계에서 번역본을 먼저 만들어 주세요.
                  </div>
                )}
              </div>
            </div>

            {saveError && (
              <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {saveError}
              </div>
            )}

            {!isHistoryView && (
              <div className="flex flex-col items-center gap-4 pb-8">
                {showPublishConfirm && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center"
                  >
                    <div className="text-3xl mb-2">🌍</div>
                    <p className="text-sm font-semibold text-amber-800">
                      도서관에 공유하면 모든 사용자에게 공개됩니다
                    </p>
                    <p className="text-xs text-amber-600 mt-1">
                      공유한 후에도 마이페이지에서 비밀로 변경할 수 있어요
                    </p>
                    <div className="flex justify-center gap-3 mt-4">
                      <button
                        onClick={() => {
                          setShowPublishConfirm(false);
                          void handlePublish();
                        }}
                        disabled={saving}
                        className="rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                      >
                        {saving ? '공유 중...' : '공유하기'}
                      </button>
                      <button
                        onClick={() => setShowPublishConfirm(false)}
                        disabled={saving}
                        className="rounded-xl border border-gray-200 bg-white px-6 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        취소
                      </button>
                    </div>
                  </motion.div>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowPublishConfirm(true)}
                  disabled={saving || showPublishConfirm}
                  className="rounded-xl bg-indigo-600 px-10 py-4 text-lg font-bold text-white shadow-lg shadow-indigo-200 transition-colors hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? '공유 중...' : '도서관에 공유하기'}
                </motion.button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
