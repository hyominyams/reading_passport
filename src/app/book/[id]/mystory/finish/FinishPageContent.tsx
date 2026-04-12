'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import VisibilitySelector from '@/components/story/VisibilitySelector';
import { createClient } from '@/lib/supabase/client';
import type { Story, StoryTranslationMap, Visibility } from '@/types/database';
import { getStepRouteWithLang } from '@/lib/mystory-steps';
import { normalizePictureBookShape, getPictureBookShapeOption } from '@/lib/picture-book-shapes';
import {
  getTranslationLanguageLabel,
  normalizeTranslatedTextsMap,
  STORY_TRANSLATION_LANGUAGE_OPTIONS,
} from '@/lib/story-translations';
import {
  STORYBOOK_FONTS,
  getRecommendedFont,
  generateFontFaceCSS,
  type StorybookFont,
} from '@/lib/storybook-fonts';

export default function FinishPageContent({ storyId }: { storyId: string | null }) {
  const params = useParams();
  const bookId = params.id as string;
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [translating, setTranslating] = useState(false);
  const [translatedTexts, setTranslatedTexts] = useState<StoryTranslationMap>({});
  const [selectedTranslateLanguage, setSelectedTranslateLanguage] = useState('en');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editedTexts, setEditedTexts] = useState<string[]>([]);
  const [selectedFont, setSelectedFont] = useState<StorybookFont | null>(null);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [fontSize, setFontSize] = useState(18);

  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 32;

  const sourceLanguage = story?.language ?? 'ko';
  const availableTranslationOptions = useMemo(
    () => STORY_TRANSLATION_LANGUAGE_OPTIONS.filter((option) => option.code !== sourceLanguage),
    [sourceLanguage]
  );

  // Load fonts via @font-face
  useEffect(() => {
    const styleId = 'storybook-fonts-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = generateFontFaceCSS();
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    const fetchStory = async () => {
      if (!storyId) { setLoading(false); return; }
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('stories')
          .select('*')
          .eq('id', storyId)
          .single();
        if (data) {
          const s = data as Story;
          setStory(s);
          setVisibility(s.visibility);
          setEditedTexts(s.final_text ?? []);
          setTranslatedTexts(
            normalizeTranslatedTextsMap(s.translated_texts, s.translation_text, s.language)
          );

          // Auto-select font based on illustration style
          const recommended = getRecommendedFont(s.illustration_style);
          setSelectedFont(recommended);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [storyId]);

  // Get image for a page (uploaded > AI generated > null)
  const getPageImage = (index: number): string | null => {
    if (!story) return null;
    const uploaded = story.uploaded_images?.[index];
    if (uploaded) return uploaded;
    const generated = story.scene_images?.[index];
    if (generated) return generated;
    return null;
  };

  const coverTitle = story?.cover_design?.title ?? '나의 이야기';
  const coverAuthor = story?.cover_design?.author ?? '';
  const coverImage = story?.cover_image_url ?? story?.cover_design?.image_url ?? null;
  const storyFontFamily = selectedFont?.fontFamily ?? 'inherit';
  const availableTranslationEntries = Object.entries(translatedTexts).filter(([, pages]) => pages.length > 0);

  // Derive aspect ratio from the user's picture book shape choice
  const pictureBookShape = normalizePictureBookShape(story?.cover_design?.picture_book_shape);
  const shapeOption = getPictureBookShapeOption(pictureBookShape);
  // CSS aspect-ratio value: '4:3' → '4/3'
  const cssAspectRatio = shapeOption.aspectRatio.replace(':', '/');
  // PDF page orientation
  const pdfOrientation = shapeOption.aspectRatio === '3:4' ? 'portrait' : shapeOption.aspectRatio === '1:1' ? 'portrait' : 'landscape';

  const handleTextEdit = (index: number, text: string) => {
    setEditedTexts(prev => prev.map((t, i) => i === index ? text : t));
  };

  // Debounced auto-save for text edits
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (!initialLoadRef.current) {
      if (editedTexts.length > 0) initialLoadRef.current = true;
      return;
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      if (!storyId) return;
      const supabase = createClient();
      await supabase.from('stories').update({ final_text: editedTexts }).eq('id', storyId);
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [editedTexts, storyId]);

  const persistReviewChanges = async (targetStep?: number) => {
    if (!storyId || !story) return;
    const supabase = createClient();
    const payload: Record<string, unknown> = {
      final_text: editedTexts,
      visibility,
      translated_texts: translatedTexts,
    };

    if (typeof targetStep === 'number') {
      payload.current_step = Math.max(story.current_step, targetStep);
    }

    const { error } = await supabase
      .from('stories')
      .update(payload)
      .eq('id', storyId);

    if (error) {
      throw error;
    }
  };

  const handleProceedToComplete = async () => {
    if (!storyId || !story) return;
    setSaving(true);
    setSaveError(null);

    try {
      await persistReviewChanges(8);
      router.push(getStepRouteWithLang(bookId, 8, storyId, story.language));
    } catch (err) {
      console.error('Complete step save error:', err);
      setSaveError('저장 중 오류가 발생했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  const handleStepSelect = async (targetStep: number) => {
    if (!storyId || !story) return;

    setSaving(true);
    setSaveError(null);

    try {
      const supabase = createClient();
      await supabase
        .from('stories')
        .update({
          final_text: editedTexts,
          visibility,
          translated_texts: translatedTexts,
          current_step: Math.max(story.current_step, targetStep),
        })
        .eq('id', storyId);
      router.push(getStepRouteWithLang(bookId, targetStep, storyId, story.language));
    } catch (err) {
      console.error('Step navigation save error:', err);
      setSaveError('저장 중 오류가 발생했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  const handleTranslate = async () => {
    if (!editedTexts.length || !storyId) return;
    setTranslating(true);
    try {
      const res = await fetch('/api/story/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: editedTexts,
          source_language: sourceLanguage,
          target_language: selectedTranslateLanguage,
        }),
      });
      const { translated_pages, target_language } = await res.json();
      const nextTranslatedTexts = {
        ...translatedTexts,
        [target_language]: translated_pages,
      };
      setTranslatedTexts(nextTranslatedTexts);

      const supabase = createClient();
      await supabase
        .from('stories')
        .update({
          translation_text: target_language === 'en' ? translated_pages : story?.translation_text ?? null,
          translated_texts: nextTranslatedTexts,
        })
        .eq('id', storyId);
    } catch (err) {
      console.error('Translation error:', err);
    }
    setTranslating(false);
  };

  const handleDownloadPdf = (languageCode?: string) => {
    const pages = languageCode ? translatedTexts[languageCode] ?? editedTexts : editedTexts;
    const title = coverTitle;
    const fontCSS = selectedFont
      ? `@font-face { font-family: '${selectedFont.fontFamily}'; src: url('${window.location.origin}/fonts/${encodeURIComponent(selectedFont.fileName)}') format('truetype'); font-display: swap; }`
      : '';

    // Build pages: cover → then for each page: image page + text page
    const bookPages: string[] = [];

    // Cover page
    bookPages.push(`
      <div class="book-page cover-page page-break">
        ${coverImage
          ? `<img src="${coverImage}" alt="Cover" class="cover-img" />`
          : `<div class="cover-text-only">
               <h1 class="cover-title">${title}</h1>
               <p class="cover-author">${coverAuthor}</p>
             </div>`
        }
      </div>
    `);

    // Content pages: image page → text page for each
    pages.forEach((text: string, i: number) => {
      const image = getPageImage(i);

      // Image page (full page illustration)
      if (image) {
        bookPages.push(`
          <div class="book-page image-page page-break">
            <img src="${image}" alt="Scene ${i + 1}" class="scene-img" />
          </div>
        `);
      }

      // Text page (centered text)
      bookPages.push(`
        <div class="book-page text-page ${i < pages.length - 1 || image ? 'page-break' : ''}">
          <div class="text-wrapper">
            <p class="story-text">${text.replace(/\n/g, '<br/>')}</p>
          </div>
        </div>
      `);
    });

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          ${fontCSS}
          @page { margin: 0; size: A4 ${pdfOrientation}; }
          @media print {
            body { margin: 0; }
            .page-break { page-break-after: always; }
          }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: ${selectedFont ? `'${selectedFont.fontFamily}',` : ''} 'Noto Sans KR', sans-serif; }

          .book-page {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            aspect-ratio: ${cssAspectRatio};
          }

          /* Cover page */
          .cover-page { background: #fafafa; }
          .cover-img { max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 8px; }
          .cover-text-only { text-align: center; }
          .cover-title { font-size: 36px; color: #2563eb; margin-bottom: 12px; }
          .cover-author { font-size: 18px; color: #666; }

          /* Image page */
          .image-page { background: #fff; }
          .scene-img { max-width: 92%; max-height: 92%; object-fit: contain; border-radius: 4px; }

          /* Text page */
          .text-page {
            background: #fff;
            padding: 60px;
          }
          .text-wrapper {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
          }
          .story-text {
            font-size: ${fontSize}px;
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
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.onload = () => printWindow.print();
    }
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story || !editedTexts.length) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-gray-500">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  return (
    <>
      <MyStoryStepSidebar currentStep={7} busy={saving || translating} onStepSelect={handleStepSelect} />
      <main className="flex-1 px-4 py-6 max-w-4xl mx-auto">
        <>
          {/* Step indicator */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                Step 6/7
              </span>
              <span>그림책 제작</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">만들어진 그림책을 확인해 보세요</h1>
            <p className="text-gray-500 mt-1">텍스트를 다듬고 번역본을 추가한 뒤 완성하기 단계로 넘어갈 수 있어요.</p>
          </div>

          {/* === Book Preview === */}
          <div className="bg-gray-50 rounded-2xl border border-gray-200 p-4 sm:p-6 mb-6">
            <h2 className="text-sm font-semibold text-gray-600 mb-4">그림책 미리보기</h2>

            {/* Cover */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
              {coverImage ? (
                <div className="relative" style={{ aspectRatio: cssAspectRatio }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverImage} alt="표지" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50" style={{ aspectRatio: cssAspectRatio }}>
                  <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-900">{coverTitle}</h2>
                    <p className="text-gray-500 text-sm mt-1">글/그림: {coverAuthor}</p>
                  </div>
                </div>
              )}
              <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
                <span className="text-xs text-gray-400">표지</span>
              </div>
            </div>

            {/* Pages: Alternating image page → text page */}
            <div className="space-y-4">
              {editedTexts.map((text, index) => {
                const image = getPageImage(index);
                const pageNum = index + 1;

                return (
                  <div key={index} className="space-y-4">
                    {/* Image page */}
                    {image && (
                      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="relative" style={{ aspectRatio: cssAspectRatio }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image} alt={`장면 ${pageNum}`} className="w-full h-full object-cover" />
                        </div>
                        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
                          <span className="text-xs text-gray-400">장면 {pageNum}</span>
                        </div>
                      </div>
                    )}

                    {/* Text page — always editable */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                      <div
                        className="flex items-center justify-center p-6 sm:p-10"
                        style={{ aspectRatio: cssAspectRatio }}
                      >
                        <textarea
                          value={text}
                          onChange={(e) => handleTextEdit(index, e.target.value)}
                          className="w-full h-full resize-none bg-transparent border-none outline-none text-gray-800 leading-loose text-center focus:ring-0 placeholder:text-gray-300"
                          style={{
                            fontFamily: `'${storyFontFamily}', sans-serif`,
                            fontSize: `${fontSize}px`,
                            lineHeight: 2,
                          }}
                          placeholder="텍스트를 입력하세요..."
                        />
                      </div>
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 text-center">
                        <span className="text-xs text-gray-400">텍스트 {pageNum}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Font & Size Settings */}
          <div className="mb-6 p-4 bg-gray-50 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">글꼴 · 크기 설정</h3>
              <button
                onClick={() => setShowFontPicker(!showFontPicker)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              >
                {showFontPicker ? '접기' : '글꼴 변경'}
              </button>
            </div>

              {/* Font size control */}
              <div className="flex items-center gap-3 mb-3">
                <span className="text-sm text-gray-500 shrink-0">글자 크기</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setFontSize((s) => Math.max(FONT_SIZE_MIN, s - 2))}
                    disabled={fontSize <= FONT_SIZE_MIN}
                    className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base font-bold"
                  >
                    -
                  </button>
                  <span className="w-12 text-center text-sm font-medium text-gray-700 tabular-nums">
                    {fontSize}px
                  </span>
                  <button
                    onClick={() => setFontSize((s) => Math.min(FONT_SIZE_MAX, s + 2))}
                    disabled={fontSize >= FONT_SIZE_MAX}
                    className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-base font-bold"
                  >
                    +
                  </button>
                </div>
              </div>

              {selectedFont && (
                <p className="text-sm text-gray-500 mb-2">
                  현재 글꼴: <span style={{ fontFamily: `'${selectedFont.fontFamily}', sans-serif` }} className="font-medium text-gray-700">{selectedFont.label}</span>
                </p>
              )}

              {showFontPicker && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
                  {STORYBOOK_FONTS.map((font) => (
                    <button
                      key={font.key}
                      onClick={() => {
                        setSelectedFont(font);
                        setShowFontPicker(false);
                      }}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        selectedFont?.key === font.key
                          ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200'
                          : 'border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <span
                        className="block text-base mb-1 text-gray-800"
                        style={{ fontFamily: `'${font.fontFamily}', sans-serif` }}
                      >
                        가나다라
                      </span>
                      <span className="text-xs text-gray-500">{font.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

          {/* Translation */}
          <div className="p-4 bg-gray-50 rounded-xl mb-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-semibold text-gray-800">번역본 추가</h3>
                <p className="mt-1 text-sm text-gray-500">
                  한국어 원본을 기준으로 다양한 언어 번역본을 추가할 수 있어요.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedTranslateLanguage}
                  onChange={(e) => setSelectedTranslateLanguage(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {availableTranslationOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleTranslate}
                  disabled={translating}
                  className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {translating ? '번역 중...' : `${getTranslationLanguageLabel(selectedTranslateLanguage)} 번역 추가`}
                </button>
              </div>
            </div>

            {availableTranslationEntries.length > 0 && (
              <div className="mt-4 space-y-2">
                {availableTranslationEntries.map(([languageCode, pages]) => (
                  <div
                    key={languageCode}
                    className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-800">
                        {getTranslationLanguageLabel(languageCode)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {pages.length}페이지 번역 완료
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownloadPdf(languageCode)}
                      className="px-4 py-2 rounded-xl bg-gray-100 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
                    >
                      PDF 다운로드
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Visibility + Complete */}
          <div className="p-4 bg-gray-50 rounded-xl">
            <h3 className="font-semibold text-gray-800 mb-3">공개 설정</h3>
            <VisibilitySelector value={visibility} onChange={setVisibility} />
          </div>

          {saveError && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center">
              <p className="text-sm text-red-600">{saveError}</p>
            </div>
          )}

          <div className="mt-8 flex justify-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleProceedToComplete}
              disabled={saving}
              className="px-10 py-4 bg-indigo-600 text-white rounded-xl text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '완성하기로 이동'}
            </motion.button>
          </div>

          {/* Download buttons */}
          <div className="mt-6 flex flex-wrap justify-center gap-3 pb-8">
            <button onClick={() => handleDownloadPdf()} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 transition-colors">
              한국어 PDF 다운로드
            </button>
            {availableTranslationEntries.map(([languageCode]) => (
              <button
                key={languageCode}
                onClick={() => handleDownloadPdf(languageCode)}
                className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm hover:bg-gray-200 transition-colors"
              >
                {getTranslationLanguageLabel(languageCode)} PDF 다운로드
              </button>
            ))}
          </div>
        </>
      </main>
    </>
  );
}
