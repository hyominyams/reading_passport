'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import VisibilitySelector from '@/components/story/VisibilitySelector';
import { createClient } from '@/lib/supabase/client';
import { getStepRouteWithLang } from '@/lib/mystory-steps';
import { normalizePictureBookShape, getPictureBookShapeOption } from '@/lib/picture-book-shapes';
import {
  getTranslationLanguageLabel,
  hasMeaningfulTranslatedPages,
  normalizeTranslatedTextsMap,
  STORY_TRANSLATION_LANGUAGE_OPTIONS,
} from '@/lib/story-translations';
import {
  STORYBOOK_FONTS,
  getRecommendedFont,
  generateFontFaceCSS,
  type StorybookFont,
} from '@/lib/storybook-fonts';
import type { Story, StoryTranslationMap, Visibility } from '@/types/database';

// ── Types ──

type BookPage =
  | { type: 'cover' }
  | { type: 'image'; index: number; url: string }
  | { type: 'text'; index: number };

function shouldFallbackToLegacyTranslationStorage(error: unknown) {
  if (error instanceof Error) {
    return error.message.includes('translated_texts');
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    return typeof message === 'string' && message.includes('translated_texts');
  }

  return false;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = error.message;
    if (typeof message === 'string' && message.trim()) {
      return message;
    }
  }

  return fallback;
}

// ── Accordion section ──

function AccordionSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
          <span>{icon}</span>
          {title}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {open && <div className="px-4 pb-4 pt-1">{children}</div>}
    </div>
  );
}

// ── Main component ──

export default function FinishPageContent({ storyId }: { storyId: string | null }) {
  const params = useParams();
  const bookId = params.id as string;
  const router = useRouter();

  // ── Core state ──
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [translating, setTranslating] = useState(false);
  const [translatedTexts, setTranslatedTexts] = useState<StoryTranslationMap>({});
  const [selectedTranslateLanguage, setSelectedTranslateLanguage] = useState('en');
  const [selectedPreviewLanguage, setSelectedPreviewLanguage] = useState<string | null>('en');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editedTexts, setEditedTexts] = useState<string[]>([]);
  const [selectedFont, setSelectedFont] = useState<StorybookFont | null>(null);
  const [fontSize, setFontSize] = useState(18);
  const [textLayoutMode, setTextLayoutMode] = useState<'edit' | 'preview'>('edit');
  const [regeneratingPageIndex, setRegeneratingPageIndex] = useState<number | null>(null);
  const autoEnglishTranslationStartedRef = useRef(false);
  const translatedTextsColumnSupportedRef = useRef(true);

  // ── New carousel + UI state ──
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [openAccordion, setOpenAccordion] = useState<string | null>(null);
  const touchStartRef = useRef<number | null>(null);
  const translationPreviewRef = useRef<HTMLDivElement | null>(null);

  const FONT_SIZE_MIN = 12;
  const FONT_SIZE_MAX = 32;

  const sourceLanguage = story?.language ?? 'ko';
  const availableTranslationOptions = useMemo(
    () => STORY_TRANSLATION_LANGUAGE_OPTIONS.filter((option) => option.code !== sourceLanguage),
    [sourceLanguage],
  );

  // ── Font loading ──
  useEffect(() => {
    const styleId = 'storybook-fonts-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = generateFontFaceCSS();
      document.head.appendChild(style);
    }
  }, []);

  // ── Fetch story ──
  useEffect(() => {
    const fetchStory = async () => {
      if (!storyId) { setLoading(false); return; }
      try {
        const supabase = createClient();
        const { data } = await supabase.from('stories').select('*').eq('id', storyId).single();
        if (data) {
          const s = data as Story;

          if (s.story_status === 'archived') {
            router.replace(`/book/${bookId}/mystory?lang=${s.language}`);
            return;
          }

          setStory(s);
          setVisibility(s.visibility);
          setEditedTexts(s.final_text ?? []);
          setTranslatedTexts(
            normalizeTranslatedTextsMap(s.translated_texts, s.translation_text, s.language),
          );
          setSelectedFont(getRecommendedFont(s.illustration_style));
        }
      } finally { setLoading(false); }
    };
    fetchStory();
    // `router` and `bookId` are route-stable here; re-fetch only when the story changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  // ── Derived values ──
  const getPageImage = useCallback((index: number): string | null => {
    if (!story) return null;
    return story.uploaded_images?.[index] ?? story.scene_images?.[index] ?? null;
  }, [story]);

  const coverTitle = story?.cover_design?.title ?? '나의 이야기';
  const coverAuthor = story?.cover_design?.author ?? '';
  const coverImage = story?.cover_image_url ?? story?.cover_design?.image_url ?? null;
  const storyFontFamily = selectedFont?.fontFamily ?? 'inherit';
  const availableTranslationEntries = Object.entries(translatedTexts).filter(([, pages]) =>
    hasMeaningfulTranslatedPages(pages)
  );
  const previewTranslationPages = selectedPreviewLanguage
    ? translatedTexts[selectedPreviewLanguage] ?? []
    : [];
  const pictureBookShape = normalizePictureBookShape(story?.cover_design?.picture_book_shape);
  const shapeOption = getPictureBookShapeOption(pictureBookShape);
  const cssAspectRatio = shapeOption.aspectRatio.replace(':', '/');

  // ── Build flat page array for carousel ──
  const allPages = useMemo<BookPage[]>(() => {
    const pages: BookPage[] = [{ type: 'cover' }];
    editedTexts.forEach((_, i) => {
      const img = getPageImage(i);
      if (img) pages.push({ type: 'image', index: i, url: img });
      pages.push({ type: 'text', index: i });
    });
    return pages;
  }, [editedTexts, getPageImage]);

  // Clamp index when pages change
  useEffect(() => {
    if (currentPageIndex >= allPages.length) {
      setCurrentPageIndex(Math.max(0, allPages.length - 1));
    }
  }, [allPages.length, currentPageIndex]);

  // ── Text editing ──
  const handleTextEdit = (index: number, text: string) => {
    setEditedTexts(prev => prev.map((t, i) => (i === index ? text : t)));
  };

  // ── Debounced auto-save with status ──
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const savedTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialLoadRef = useRef(false);

  useEffect(() => {
    if (!initialLoadRef.current) {
      if (editedTexts.length > 0) initialLoadRef.current = true;
      return;
    }
    setSaveStatus('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      if (!storyId) return;
      const supabase = createClient();
      await supabase.from('stories').update({ final_text: editedTexts }).eq('id', storyId);
      setSaveStatus('saved');
      savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
    }, 1500);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [editedTexts, storyId]);

  const persistEditedTextsImmediately = useCallback(async () => {
    if (!storyId) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);

    setSaveStatus('saving');

    const supabase = createClient();
    const { error } = await supabase
      .from('stories')
      .update({ final_text: editedTexts })
      .eq('id', storyId);

    if (error) {
      throw error;
    }

    setStory((prev) => (
      prev
        ? {
          ...prev,
          final_text: editedTexts,
        }
        : prev
    ));

    setSaveStatus('saved');
    savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), 3000);
  }, [editedTexts, storyId]);

  // ── Auto English translation ──
  useEffect(() => { autoEnglishTranslationStartedRef.current = false; }, [storyId]);

  useEffect(() => {
    if (
      selectedPreviewLanguage &&
      availableTranslationEntries.length > 0 &&
      !hasMeaningfulTranslatedPages(translatedTexts[selectedPreviewLanguage])
    ) {
      setSelectedPreviewLanguage(availableTranslationEntries[0][0]);
    }
  }, [availableTranslationEntries, selectedPreviewLanguage, translatedTexts]);

  // ── Persist helper ──
  const persistReviewChanges = async (targetStep?: number) => {
    if (!storyId || !story) return;
    const supabase = createClient();
    const englishTranslation = translatedTexts.en ?? story.translation_text ?? null;
    const payload: Record<string, unknown> = {
      final_text: editedTexts,
      visibility,
      translation_text: englishTranslation,
      translated_texts: translatedTexts,
    };
    if (typeof targetStep === 'number') payload.current_step = Math.max(story.current_step, targetStep);
    const nextPayload = translatedTextsColumnSupportedRef.current
      ? payload
      : { ...payload, translated_texts: undefined };
    if (!translatedTextsColumnSupportedRef.current) {
      delete nextPayload.translated_texts;
    }
    let { error } = await supabase.from('stories').update(nextPayload).eq('id', storyId);

    if (error && shouldFallbackToLegacyTranslationStorage(error)) {
      translatedTextsColumnSupportedRef.current = false;
      const legacyPayload = { ...payload };
      delete legacyPayload.translated_texts;
      ({ error } = await supabase.from('stories').update(legacyPayload).eq('id', storyId));
    }

    if (error) throw error;
  };

  const handleProceedToComplete = async () => {
    if (!storyId || !story) return;
    setSaving(true);
    setSaveError(null);
    setActionError(null);
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
    setActionError(null);
    try {
      const supabase = createClient();
      const payload: Record<string, unknown> = {
        final_text: editedTexts,
        visibility,
        translation_text: translatedTexts.en ?? story.translation_text ?? null,
        translated_texts: translatedTexts,
        current_step: Math.max(story.current_step, targetStep),
      };
      const nextPayload = translatedTextsColumnSupportedRef.current
        ? payload
        : { ...payload, translated_texts: undefined };
      if (!translatedTextsColumnSupportedRef.current) {
        delete nextPayload.translated_texts;
      }
      let { error } = await supabase.from('stories').update(nextPayload).eq('id', storyId);
      if (error && shouldFallbackToLegacyTranslationStorage(error)) {
        translatedTextsColumnSupportedRef.current = false;
        const legacyPayload = { ...payload };
        delete legacyPayload.translated_texts;
        ({ error } = await supabase.from('stories').update(legacyPayload).eq('id', storyId));
      }
      if (error) {
        throw error;
      }
      router.push(getStepRouteWithLang(bookId, targetStep, storyId, story.language));
    } catch (err) {
      console.error('Step navigation save error:', err);
      setSaveError('저장 중 오류가 발생했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  const handleReturnToCoverDesign = async () => {
    if (!storyId || !story) return;

    setSaving(true);
    setSaveError(null);
    setActionError(null);

    try {
      await persistReviewChanges();
      router.push(getStepRouteWithLang(bookId, 6, storyId, story.language));
    } catch (err) {
      console.error('Return to cover design error:', err);
      setActionError('표지 단계로 이동하는 중 오류가 발생했어요.');
      setSaving(false);
    }
  };

  const handleRegeneratePageImage = async (pageIndex: number) => {
    if (!storyId || !story) return;

    setActionError(null);
    setSaveError(null);
    setRegeneratingPageIndex(pageIndex);

    try {
      await persistEditedTextsImmediately();

      const response = await fetch('/api/story/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storyId,
          pageIndex,
          pageText: editedTexts[pageIndex] ?? '',
          forceRegenerate: true,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '이미지 다시 생성에 실패했어요.');
      }

      const nextSceneImages = Array.isArray(data.scene_images)
        ? data.scene_images as Array<string | null>
        : [...(story.scene_images ?? [])];

      if (typeof data.image_url === 'string') {
        nextSceneImages[pageIndex] = data.image_url;
      }

      setStory((prev) => (
        prev
          ? {
            ...prev,
            final_text: editedTexts,
            scene_images: nextSceneImages as unknown as string[],
            production_progress:
              typeof data.progress === 'number'
                ? data.progress
                : prev.production_progress,
            production_status:
              typeof data.progress === 'number'
                ? (data.progress >= 100 ? 'completed' : 'pending')
                : prev.production_status,
          }
          : prev
      ));
    } catch (err) {
      console.error('Page image regeneration error:', err);
      setActionError(getErrorMessage(err, '이미지 다시 생성 중 오류가 발생했어요.'));
    } finally {
      setRegeneratingPageIndex(null);
    }
  };

  // ── Translation ──
  const translateToLanguage = useCallback(async (targetLanguage: string, silent = false) => {
    if (!editedTexts.length || !storyId) return;
    setTranslating(true);
    if (!silent) setTranslationError(null);
    try {
      const res = await fetch('/api/story/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: editedTexts, source_language: sourceLanguage, target_language: targetLanguage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '번역에 실패했어요.');
      const { translated_pages, target_language } = data as { translated_pages: string[]; target_language: string };
      const next = { ...translatedTexts, [target_language]: translated_pages };
      setTranslatedTexts(next);
      setSelectedPreviewLanguage(target_language);
      setOpenAccordion('translate');
      requestAnimationFrame(() => {
        translationPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
      const supabase = createClient();
      const savePayload: Record<string, unknown> = {
        translation_text: target_language === 'en' ? translated_pages : story?.translation_text ?? null,
        translated_texts: next,
      };
      const nextPayload = translatedTextsColumnSupportedRef.current
        ? savePayload
        : { ...savePayload, translated_texts: undefined };
      if (!translatedTextsColumnSupportedRef.current) {
        delete nextPayload.translated_texts;
      }
      let { error } = await supabase.from('stories').update(nextPayload).eq('id', storyId);
      if (error && shouldFallbackToLegacyTranslationStorage(error)) {
        translatedTextsColumnSupportedRef.current = false;
        ({ error } = await supabase.from('stories').update({
          translation_text: target_language === 'en' ? translated_pages : story?.translation_text ?? null,
        }).eq('id', storyId));
      }
      if (error) {
        throw error;
      }
    } catch (err) {
      console.error('Translation error:', err);
      setTranslationError(getErrorMessage(err, '번역 중 오류가 발생했어요.'));
    }
    setTranslating(false);
  }, [editedTexts, sourceLanguage, story?.translation_text, storyId, translatedTexts]);

  useEffect(() => {
    if (
      loading ||
      !storyId ||
      !editedTexts.length ||
      sourceLanguage === 'en' ||
      hasMeaningfulTranslatedPages(translatedTexts.en) ||
      autoEnglishTranslationStartedRef.current
    ) return;
    autoEnglishTranslationStartedRef.current = true;
    void translateToLanguage('en', true);
  }, [editedTexts, loading, sourceLanguage, storyId, translateToLanguage, translatedTexts.en]);

  const handleTranslate = async () => { await translateToLanguage(selectedTranslateLanguage); };

  // ── Carousel navigation ──
  const goTo = (i: number) => setCurrentPageIndex(Math.max(0, Math.min(allPages.length - 1, i)));
  const goPrev = () => goTo(currentPageIndex - 1);
  const goNext = () => goTo(currentPageIndex + 1);

  const handleTouchStart = (e: React.TouchEvent) => { touchStartRef.current = e.touches[0].clientX; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartRef.current === null) return;
    const diff = touchStartRef.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        goNext();
      } else {
        goPrev();
      }
    }
    touchStartRef.current = null;
  };

  // ── Loading / empty ──
  if (loading) return <main className="flex-1 flex items-center justify-center"><LoadingSpinner message="로딩 중..." /></main>;
  if (!story || !editedTexts.length) return <main className="flex-1 flex items-center justify-center"><p className="text-gray-500">이야기를 찾을 수 없습니다.</p></main>;

  const currentPage = allPages[currentPageIndex];
  const currentStoryPageIndex = currentPage.type === 'cover' ? null : currentPage.index;
  const currentPageUsesUploadedImage =
    currentStoryPageIndex !== null
      ? Boolean(story.uploaded_images?.[currentStoryPageIndex])
      : false;
  const currentPageHasSceneImage =
    currentStoryPageIndex !== null
      ? Boolean(story.scene_images?.[currentStoryPageIndex])
      : false;
  const canRegenerateCurrentPage =
    currentStoryPageIndex !== null
    && !currentPageUsesUploadedImage
    && Boolean(editedTexts[currentStoryPageIndex]?.trim());
  const isCurrentPageRegenerating =
    currentStoryPageIndex !== null && regeneratingPageIndex === currentStoryPageIndex;

  // ── Render ──
  return (
    <>
      <MyStoryStepSidebar currentStep={7} busy={saving || translating} onStepSelect={handleStepSelect} />
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Step indicator */}
        <div className="px-4 pt-6 pb-2">
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">Step 6/7</span>
            <span>그림책 제작</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">만들어진 그림책을 확인해 보세요</h1>
        </div>

        {/* ── Sticky toolbar ── */}
        <div className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-gray-200 px-4 py-2">
          <div className="flex items-center justify-between gap-2">
            {/* Left: edit / preview toggle */}
            <div className="inline-flex items-center rounded-full bg-gray-100 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setTextLayoutMode('edit')}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${textLayoutMode === 'edit' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M13.488 2.513a1.75 1.75 0 0 0-2.475 0L3.05 10.476a.75.75 0 0 0-.188.333l-.758 2.842a.75.75 0 0 0 .915.915l2.842-.758a.75.75 0 0 0 .333-.188l7.963-7.963a1.75 1.75 0 0 0 0-2.475l-.67-.669Z" /></svg>
                편집
              </button>
              <button
                type="button"
                onClick={() => setTextLayoutMode('preview')}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${textLayoutMode === 'preview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-3 h-3"><path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /><path fillRule="evenodd" d="M1.38 8.28a.87.87 0 0 1 0-.56 7.003 7.003 0 0 1 13.24 0 .87.87 0 0 1 0 .56 7.003 7.003 0 0 1-13.24 0ZM11 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" clipRule="evenodd" /></svg>
                정렬
              </button>
            </div>

            {/* Center: font size */}
            <div className="flex items-center gap-1">
              <button onClick={() => setFontSize(s => Math.max(FONT_SIZE_MIN, s - 2))} disabled={fontSize <= FONT_SIZE_MIN} className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold">-</button>
              <span className="w-10 text-center text-xs font-medium text-gray-600 tabular-nums">{fontSize}px</span>
              <button onClick={() => setFontSize(s => Math.min(FONT_SIZE_MAX, s + 2))} disabled={fontSize >= FONT_SIZE_MAX} className="w-7 h-7 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-30 text-sm font-bold">+</button>
            </div>

            {/* Right: font picker + save status */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowFontPicker(!showFontPicker)}
                className="text-xs text-indigo-600 font-medium hover:text-indigo-700 whitespace-nowrap"
              >
                {showFontPicker ? '닫기' : '글꼴'}
              </button>
              <span className={`text-[10px] whitespace-nowrap transition-opacity ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'} ${saveStatus === 'saving' ? 'text-amber-500' : 'text-green-600'}`}>
                {saveStatus === 'saving' ? '저장 중...' : '저장됨 ✓'}
              </span>
            </div>
          </div>

          {/* Font picker dropdown */}
          {showFontPicker && (
            <div className="mt-2 pb-1 grid grid-cols-3 gap-1.5">
              {STORYBOOK_FONTS.map(font => (
                <button
                  key={font.key}
                  onClick={() => { setSelectedFont(font); setShowFontPicker(false); }}
                  className={`p-2 rounded-lg border text-center transition-all ${selectedFont?.key === font.key ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                  <span className="block text-sm text-gray-800" style={{ fontFamily: `'${font.fontFamily}', sans-serif` }}>가나다</span>
                  <span className="text-[10px] text-gray-500">{font.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Carousel ── */}
        <div className="flex-1 flex flex-col px-4 py-4">
          <div
            className="relative flex-1 flex items-center justify-center"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Left arrow */}
            <button
              onClick={goPrev}
              disabled={currentPageIndex === 0}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/80 border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              aria-label="이전 페이지"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" /></svg>
            </button>

            {/* Page content */}
            <div className="w-full max-w-2xl mx-8 sm:mx-14">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentPageIndex}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
                    {currentPage.type === 'cover' && (
                      coverImage ? (
                        <div className="relative" style={{ aspectRatio: cssAspectRatio }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={coverImage} alt="표지" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center bg-gradient-to-br from-indigo-50 to-blue-50" style={{ aspectRatio: cssAspectRatio }}>
                          <div className="text-center px-6">
                            <h2 className="text-xl font-bold text-gray-900">{coverTitle}</h2>
                            <p className="text-gray-500 text-sm mt-1">글/그림: {coverAuthor}</p>
                          </div>
                        </div>
                      )
                    )}

                    {currentPage.type === 'image' && (
                      <div className="relative" style={{ aspectRatio: cssAspectRatio }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={currentPage.url} alt={`장면 ${currentPage.index + 1}`} className="w-full h-full object-cover" />
                      </div>
                    )}

                    {currentPage.type === 'text' && (
                      <div
                        className="flex items-center justify-center p-6 sm:p-10"
                        style={{ aspectRatio: cssAspectRatio }}
                      >
                        {textLayoutMode === 'edit' ? (
                          <div className="flex h-full w-full items-center justify-center -translate-y-[4%]">
                            <textarea
                              value={editedTexts[currentPage.index] ?? ''}
                              onChange={(e) => handleTextEdit(currentPage.index, e.target.value)}
                              className="h-full w-full resize-none bg-transparent border-none outline-none text-center text-gray-800 leading-loose focus:ring-0 placeholder:text-gray-300"
                              style={{ fontFamily: `'${storyFontFamily}', sans-serif`, fontSize: `${fontSize}px`, lineHeight: 2 }}
                              placeholder="텍스트를 입력하세요..."
                            />
                          </div>
                        ) : (
                          <div className="flex h-full w-full cursor-text items-center justify-center" onDoubleClick={() => setTextLayoutMode('edit')}>
                            <div className="flex w-full items-center justify-center -translate-y-[4%]">
                              <p
                                className="max-w-[700px] shrink-0 whitespace-pre-wrap text-center text-gray-800"
                                style={{ fontFamily: `'${storyFontFamily}', sans-serif`, fontSize: `${fontSize}px`, lineHeight: 2, wordBreak: 'keep-all' }}
                              >
                                {editedTexts[currentPage.index] || '텍스트를 입력하세요...'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Page label */}
                  <p className="text-center text-xs text-gray-400 mt-2">
                    {currentPage.type === 'cover' && '표지'}
                    {currentPage.type === 'image' && `장면 ${currentPage.index + 1}`}
                    {currentPage.type === 'text' && `텍스트 ${currentPage.index + 1}`}
                  </p>

                  <div className="mt-3 flex flex-col items-center gap-2">
                    {currentPage.type === 'cover' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleReturnToCoverDesign()}
                          disabled={saving || translating || regeneratingPageIndex !== null}
                          className="rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          표지 다시 만들기
                        </button>
                        <p className="text-center text-xs text-gray-500">
                          표지 디자인 단계로 돌아가 표지를 바꾼 뒤 다시 제작할 수 있어요.
                        </p>
                      </>
                    ) : currentPageUsesUploadedImage ? (
                      <p className="text-center text-xs text-gray-500">
                        이 페이지는 직접 올린 그림을 사용 중이라 장면 상상하기 단계에서 변경할 수 있어요.
                      </p>
                    ) : canRegenerateCurrentPage ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleRegeneratePageImage(currentPage.index)}
                          disabled={saving || translating || isCurrentPageRegenerating}
                          className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {isCurrentPageRegenerating
                            ? '이미지 다시 만드는 중...'
                            : currentPageHasSceneImage
                              ? '이미지 다시 생성하기'
                              : '이 페이지 이미지 생성하기'}
                        </button>
                        <p className="text-center text-xs text-gray-500">
                          현재 페이지 대사와 본문을 기준으로, 기존 캐릭터와 스타일을 유지해 다시 그려요.
                        </p>
                      </>
                    ) : (
                      <p className="text-center text-xs text-gray-500">
                        먼저 이 페이지의 대사나 본문을 입력해 주세요.
                      </p>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right arrow */}
            <button
              onClick={goNext}
              disabled={currentPageIndex >= allPages.length - 1}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full bg-white/80 border border-gray-200 shadow-sm flex items-center justify-center text-gray-600 hover:bg-white disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
              aria-label="다음 페이지"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>
            </button>
          </div>

          {/* Page counter + dot nav */}
          <div className="mt-3 flex flex-col items-center gap-2">
            <span className="text-xs font-medium text-gray-500 tabular-nums">
              {currentPageIndex + 1} / {allPages.length}
            </span>
            <div className="flex items-center gap-1 flex-wrap justify-center max-w-xs">
              {allPages.map((page, i) => (
                <button
                  key={i}
                  onClick={() => goTo(i)}
                  className={`rounded-full transition-all ${
                    i === currentPageIndex
                      ? 'w-5 h-2 bg-indigo-500'
                      : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
                  }`}
                  aria-label={`페이지 ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Settings accordion ── */}
        <div className="px-4 pb-4 space-y-2">
          {/* Font selection */}
          <AccordionSection
            title="글꼴 선택"
            icon="🖋"
            open={openAccordion === 'font'}
            onToggle={() => setOpenAccordion(openAccordion === 'font' ? null : 'font')}
          >
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {STORYBOOK_FONTS.map(font => (
                <button
                  key={font.key}
                  onClick={() => { setSelectedFont(font); setOpenAccordion(null); }}
                  className={`p-3 rounded-xl border text-center transition-all ${selectedFont?.key === font.key ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-200' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                >
                  <span className="block text-base mb-0.5 text-gray-800" style={{ fontFamily: `'${font.fontFamily}', sans-serif` }}>가나다라</span>
                  <span className="text-xs text-gray-500">{font.label}</span>
                </button>
              ))}
            </div>
          </AccordionSection>

          {/* Translation */}
          <AccordionSection
            title={`번역 ${availableTranslationEntries.length > 0 ? `(${availableTranslationEntries.length}개 언어)` : ''}`}
            icon="🌐"
            open={openAccordion === 'translate'}
            onToggle={() => setOpenAccordion(openAccordion === 'translate' ? null : 'translate')}
          >
            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={selectedTranslateLanguage}
                  onChange={(e) => setSelectedTranslateLanguage(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  {availableTranslationOptions.map(opt => (
                    <option key={opt.code} value={opt.code}>{opt.label}</option>
                  ))}
                </select>
                <button
                  onClick={handleTranslate}
                  disabled={translating}
                  className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {translating ? '번역 중...' : '번역 추가'}
                </button>
              </div>

              {sourceLanguage !== 'en' && !translatedTexts.en?.length && !translationError && (
                <p className="text-sm text-indigo-600">영어 번역본을 자동으로 준비하고 있어요.</p>
              )}
              {translationError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{translationError}</div>
              )}

              {availableTranslationEntries.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500 font-medium">번역된 언어</p>
                  {availableTranslationEntries.map(([code, pages]) => (
                    <div key={code} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <span className="text-sm font-medium text-gray-800">{getTranslationLanguageLabel(code)} ({pages.length}p)</span>
                      <button
                        onClick={() => {
                          if (selectedPreviewLanguage === code) {
                            setSelectedPreviewLanguage(null);
                            return;
                          }

                          setSelectedPreviewLanguage(code);
                          requestAnimationFrame(() => {
                            translationPreviewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                          });
                        }}
                        className="text-xs text-indigo-600 font-medium"
                      >
                        {selectedPreviewLanguage === code ? '닫기' : '보기'}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {selectedPreviewLanguage && previewTranslationPages.length > 0 && (
                <div ref={translationPreviewRef} className="space-y-2 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 font-medium">{getTranslationLanguageLabel(selectedPreviewLanguage)} 미리보기</p>
                    <select value={selectedPreviewLanguage} onChange={e => setSelectedPreviewLanguage(e.target.value)} className="rounded-lg border border-gray-200 px-2 py-1 text-xs">
                      {availableTranslationEntries.map(([code]) => <option key={code} value={code}>{getTranslationLanguageLabel(code)}</option>)}
                    </select>
                  </div>
                  {previewTranslationPages.map((t, i) => (
                    <div key={`${selectedPreviewLanguage}-${i}`} className="rounded-lg border border-gray-200 bg-white p-3">
                      <p className="text-xs text-gray-400 mb-1">p.{i + 1}</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap" style={{ fontFamily: `'${storyFontFamily}', sans-serif` }}>
                        {t || '번역 텍스트가 비어 있어요. 다시 번역해 주세요.'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AccordionSection>

          {/* Visibility */}
          <AccordionSection
            title="공개 설정"
            icon="🔒"
            open={openAccordion === 'visibility'}
            onToggle={() => setOpenAccordion(openAccordion === 'visibility' ? null : 'visibility')}
          >
            <VisibilitySelector value={visibility} onChange={setVisibility} />
          </AccordionSection>
        </div>

        {/* ── Error + Complete ── */}
        {(saveError || actionError) && (
          <div className="mx-4 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-center">
            <p className="text-sm text-red-600">{saveError ?? actionError}</p>
          </div>
        )}

        <div className="px-4 pb-8 flex justify-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleProceedToComplete}
            disabled={saving}
            className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-xl text-lg font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '완성하기로 이동'}
          </motion.button>
        </div>
      </main>
    </>
  );
}
