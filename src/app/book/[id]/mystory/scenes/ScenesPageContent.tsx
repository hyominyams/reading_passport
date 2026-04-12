'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import { createClient } from '@/lib/supabase/client';
import type { Story } from '@/types/database';
import { getStepRouteWithLang } from '@/lib/mystory-steps';

type PageChoice = 'upload' | 'describe' | 'skip';

interface PageState {
  choice: PageChoice;
  imageUrl: string | null;
  description: string;
  uploading: boolean;
}

function buildInitialStates(
  pageCount: number,
  existingImages: string[] | null,
  existingDescriptions: string[] | null,
): PageState[] {
  return Array.from({ length: pageCount }, (_, i) => {
    const hasImage = existingImages?.[i] ?? null;
    const hasDesc = existingDescriptions?.[i] ?? null;

    let choice: PageChoice = 'skip';
    if (hasImage) choice = 'upload';
    else if (hasDesc) choice = 'describe';

    return {
      choice,
      imageUrl: hasImage ?? null,
      description: hasDesc ?? '',
      uploading: false,
    };
  });
}

export default function ScenesPageContent({ storyId }: { storyId: string | null }) {
  const params = useParams();
  const bookId = params.id as string;
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageStates, setPageStates] = useState<PageState[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load story data
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
          const s = data as Story;
          setStory(s);

          // Guard: scenes needs story text to exist
          if (!s.final_text || s.final_text.length === 0) {
            router.replace(`/book/${bookId}/mystory/draft?storyId=${storyId}&lang=${s.language}`);
            return;
          }

          if (s.final_text && s.final_text.length > 0) {
            setPageStates(
              buildInitialStates(
                s.final_text.length,
                s.uploaded_images,
                s.scene_descriptions,
              ),
            );
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [storyId, bookId, router]);

  const updatePageState = useCallback(
    (index: number, updates: Partial<PageState>) => {
      setPageStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
      });
    },
    [],
  );

  // Auto-save descriptions and choices to DB
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const saveToDb = useCallback(
    async (states: PageState[]) => {
      if (!storyId) return;
      const supabase = createClient();
      const uploadedImages = states.map((s) =>
        s.choice === 'upload' ? s.imageUrl : null,
      );
      const sceneDescriptions = states.map((s) =>
        s.choice === 'describe' ? s.description || null : null,
      );

      await supabase
        .from('stories')
        .update({
          uploaded_images: uploadedImages as string[],
          scene_descriptions: sceneDescriptions as string[],
        })
        .eq('id', storyId);
    },
    [storyId],
  );

  // Debounced auto-save on state changes (after initial load)
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current) {
      if (pageStates.length > 0) initialLoadDone.current = true;
      return;
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void saveToDb(pageStates);
    }, 1000);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [pageStates, saveToDb]);

  const handleFileUpload = async (index: number, file: File) => {
    if (!storyId) return;
    setError(null);

    // Client-side validation
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setError('JPG 또는 PNG 파일만 업로드할 수 있어요.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('파일 크기는 5MB 이하여야 해요.');
      return;
    }

    updatePageState(index, { uploading: true });

    try {
      const formData = new FormData();
      formData.append('storyId', storyId);
      formData.append('file', file);

      const res = await fetch('/api/story/upload-drawing', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Upload failed');
      }

      const { url } = await res.json();
      updatePageState(index, { imageUrl: url, uploading: false });
    } catch (err) {
      console.error('Upload error:', err);
      setError(
        err instanceof Error ? err.message : '업로드에 실패했어요. 다시 시도해 주세요.',
      );
      updatePageState(index, { uploading: false });
    }
  };

  const handleFinish = async () => {
    if (!storyId) return;
    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const uploadedImages = pageStates.map((s) =>
        s.choice === 'upload' ? s.imageUrl : null,
      );
      const sceneDescriptions = pageStates.map((s) =>
        s.choice === 'describe' ? s.description || null : null,
      );

      const { error: updateError } = await supabase
        .from('stories')
        .update({
          uploaded_images: uploadedImages as string[],
          scene_descriptions: sceneDescriptions as string[],
          current_step: 5,
        })
        .eq('id', storyId);

      if (updateError) throw updateError;

      router.push(`/book/${bookId}/mystory/characters?storyId=${storyId}`);
    } catch (err) {
      console.error('Save error:', err);
      setError('저장에 실패했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  const handleStepSelect = useCallback(async (targetStep: number) => {
    if (!storyId || !story) return;

    setSaving(true);
    setError(null);

    try {
      const uploadedImages = pageStates.map((s) =>
        s.choice === 'upload' ? s.imageUrl : null
      );
      const sceneDescriptions = pageStates.map((s) =>
        s.choice === 'describe' ? s.description || null : null
      );

      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('stories')
        .update({
          uploaded_images: uploadedImages as string[],
          scene_descriptions: sceneDescriptions as string[],
          current_step: Math.max(story.current_step, targetStep),
        })
        .eq('id', storyId);

      if (updateError) throw updateError;

      router.push(getStepRouteWithLang(bookId, targetStep, storyId, story.language));
    } catch (err) {
      console.error('Step navigation save error:', err);
      setError('저장에 실패했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  }, [bookId, pageStates, router, story, storyId]);

  // --- Render ---

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story || !story.final_text || story.final_text.length === 0) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[60vh]">
        <p className="text-muted">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  const pages = story.final_text;

  return (
    <>
      <MyStoryStepSidebar currentStep={4} busy={saving} onStepSelect={handleStepSelect} />
      <div className="flex-1 flex justify-center">
      <main className="flex-1 px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-muted mb-1">Step 3/7</p>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            장면 상상하기
          </h1>
          <p className="text-sm text-muted mt-2">
            각 페이지에 들어갈 그림을 직접 올리거나, 장면을 설명해 주세요.
            비워두기를 선택해도 괜찮아요.
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Page cards */}
        <div className="flex flex-col gap-6">
          {pages.map((text, index) => (
            <PageCard
              key={index}
              index={index}
              text={text}
              state={pageStates[index]}
              onChoiceChange={(choice) => {
                updatePageState(index, {
                  choice,
                  // Reset image when switching away from upload
                  ...(choice !== 'upload' ? { imageUrl: pageStates[index]?.imageUrl ?? null } : {}),
                });
              }}
              onDescriptionChange={(desc) =>
                updatePageState(index, { description: desc })
              }
              onFileUpload={(file) => handleFileUpload(index, file)}
            />
          ))}
        </div>

        {/* Bottom button */}
        <div className="mt-10 flex justify-end">
          <button
            type="button"
            onClick={() => void handleFinish()}
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-foreground text-white font-medium text-sm
              hover:bg-foreground/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? '저장 중...' : '주인공 설정하러 가기'}
          </button>
        </div>
      </main>

      {/* Right-side CTA — desktop only */}
      <aside className="hidden lg:block w-52 shrink-0 pt-32 pr-4">
        <div className="sticky top-28">
          <div className="flex flex-col items-center text-center">
            {/* Artist character */}
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-100 to-pink-100 border-2 border-amber-200 flex items-center justify-center text-3xl shadow-sm mb-3">
              🎨
            </div>

            {/* Speech bubble */}
            <div className="relative bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm mb-3">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45" />
              <p className="text-xs text-gray-600 leading-relaxed font-medium">
                그림을 잘 만드는 법을<br />알고 싶지 않아?
              </p>
            </div>

            {/* CTA button */}
            <button
              type="button"
              onClick={() => window.open('/guide/prompt-tips', '_blank')}
              className="px-4 py-2 rounded-full bg-amber-400 hover:bg-amber-500
                text-white text-xs font-bold shadow-sm
                hover:shadow-md transition-all hover:scale-105 active:scale-95"
            >
              배우러 가기
            </button>
          </div>
        </div>
      </aside>
      </div>
    </>
  );
}

// ── PageCard ──

function PageCard({
  index,
  text,
  state,
  onChoiceChange,
  onDescriptionChange,
  onFileUpload,
}: {
  index: number;
  text: string;
  state: PageState | undefined;
  onChoiceChange: (choice: PageChoice) => void;
  onDescriptionChange: (desc: string) => void;
  onFileUpload: (file: File) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const choice = state?.choice ?? 'skip';

  return (
    <div className="rounded-2xl border border-border/60 bg-white p-5 shadow-sm">
      {/* Page number badge */}
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-foreground/[0.08] text-foreground text-xs font-bold">
          #{index + 1}
        </span>
        <span className="text-sm font-medium text-foreground">
          페이지 {index + 1}
        </span>
      </div>

      {/* Text preview */}
      <div className="mb-4 p-3 rounded-lg bg-gray-50 border border-gray-100">
        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
          {text}
        </p>
      </div>

      {/* Radio options */}
      <div className="flex flex-col gap-2 mb-4">
        <RadioOption
          label="내가 그린 그림 올리기"
          sublabel="JPG/PNG, 5MB 이하"
          selected={choice === 'upload'}
          onSelect={() => onChoiceChange('upload')}
        />
        <RadioOption
          label="장면을 설명해 주세요"
          sublabel="텍스트로 장면 묘사"
          selected={choice === 'describe'}
          onSelect={() => onChoiceChange('describe')}
        />
        <RadioOption
          label="비워두기"
          sublabel="이 페이지는 그림 없이"
          selected={choice === 'skip'}
          onSelect={() => onChoiceChange('skip')}
        />
      </div>

      {/* Conditional inputs */}
      {choice === 'upload' && (
        <div className="mt-2">
          {state?.uploading ? (
            <div className="flex items-center justify-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
              <LoadingSpinner size="sm" message="업로드 중..." />
            </div>
          ) : state?.imageUrl ? (
            <div className="relative group">
              <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-gray-200">
                <Image
                  src={state.imageUrl}
                  alt={`페이지 ${index + 1} 그림`}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 672px"
                />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 text-xs text-muted hover:text-foreground transition-colors"
              >
                다른 그림으로 변경
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-8 border-2 border-dashed border-gray-300 rounded-xl
                bg-gray-50 hover:bg-gray-100 hover:border-gray-400
                text-gray-400 hover:text-gray-600 transition-colors text-sm cursor-pointer"
            >
              <span className="block text-2xl mb-1">+</span>
              파일 선택하기
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onFileUpload(file);
              // Reset input so the same file can be re-selected
              e.target.value = '';
            }}
          />
        </div>
      )}

      {choice === 'describe' && (
        <textarea
          value={state?.description ?? ''}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="이 페이지의 장면을 자유롭게 설명해 주세요..."
          rows={3}
          className="mt-2 w-full px-4 py-3 rounded-xl border border-gray-200
            bg-gray-50 text-sm text-foreground placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30
            resize-none"
        />
      )}
    </div>
  );
}

// ── RadioOption ──

function RadioOption({
  label,
  sublabel,
  selected,
  onSelect,
}: {
  label: string;
  sublabel: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${
        selected
          ? 'border-foreground/40 bg-foreground/[0.04]'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <span
        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
          selected ? 'border-foreground' : 'border-gray-300'
        }`}
      >
        {selected && (
          <span className="w-2.5 h-2.5 rounded-full bg-foreground" />
        )}
      </span>
      <span className="flex flex-col">
        <span
          className={`text-sm font-medium ${
            selected ? 'text-foreground' : 'text-gray-700'
          }`}
        >
          {label}
        </span>
        <span className="text-xs text-gray-400">{sublabel}</span>
      </span>
    </button>
  );
}
