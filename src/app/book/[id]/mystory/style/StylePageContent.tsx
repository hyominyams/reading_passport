'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import { createClient } from '@/lib/supabase/client';
import type { Story, CoverDesign, CharacterRef, PictureBookShape } from '@/types/database';
import { getStepRouteWithLang } from '@/lib/mystory-steps';
import { getIllustrationStyleOption, normalizeIllustrationStyle } from '@/lib/illustration-styles';
import {
  DEFAULT_PICTURE_BOOK_SHAPE,
  getPictureBookShapeOption,
  normalizePictureBookShape,
  PICTURE_BOOK_SHAPE_OPTIONS,
} from '@/lib/picture-book-shapes';

type CoverImageMode = 'upload' | 'describe' | 'skip';

const PICTURE_BOOK_SHAPE_BUTTON_LABELS: Record<PictureBookShape, string> = {
  landscape_4_3: '가로형',
  portrait_3_4: '세로형',
  square_1_1: '정사각형',
};

export default function StylePageContent({ storyId }: { storyId: string | null }) {
  const params = useParams();
  const bookId = params.id as string;
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cover design
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [pictureBookShape, setPictureBookShape] = useState<PictureBookShape>(DEFAULT_PICTURE_BOOK_SHAPE);
  const [coverImageMode, setCoverImageMode] = useState<CoverImageMode>('skip');
  const [coverDescription, setCoverDescription] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [generatedCoverUrl, setGeneratedCoverUrl] = useState<string | null>(null);
  const [coverGenerating, setCoverGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load story
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

          const hasValidCharacter = Array.isArray(s.character_designs)
            && s.character_designs.some((character) =>
              typeof character?.name === 'string' && character.name.trim().length > 0
            );

          // Guard: style step needs at least one saved character
          if (!hasValidCharacter) {
            router.replace(`/book/${bookId}/mystory/characters?storyId=${storyId}&lang=${s.language}`);
            return;
          }

          // Pre-fill from existing data
          if (s.cover_design) {
            const cd = s.cover_design as CoverDesign;
            if (cd.title) setTitle(cd.title);
            if (cd.author) setAuthor(cd.author);
            setPictureBookShape(normalizePictureBookShape(cd.picture_book_shape));
            if (cd.description) {
              setCoverImageMode('describe');
              setCoverDescription(cd.description);
            }
            if (cd.image_url) {
              setCoverImageMode('upload');
              setUploadedImageUrl(cd.image_url);
              setCoverPreviewUrl(cd.image_url);
            }
          }
          if (s.cover_image_url) {
            setGeneratedCoverUrl(s.cover_image_url);
            if (s.cover_design?.description && !s.cover_design?.image_url) {
              setCoverImageMode('describe');
              setCoverPreviewUrl(s.cover_image_url);
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [storyId, bookId, router]);

  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setUploadedImageUrl(null);
    const url = URL.createObjectURL(file);
    setCoverPreviewUrl(url);
  };

  // Upload cover image
  const uploadCoverImage = async (): Promise<string | null> => {
    if (!coverFile || !storyId) return uploadedImageUrl;
    if (uploadedImageUrl) return uploadedImageUrl;

    const formData = new FormData();
    formData.append('file', coverFile);
    formData.append('storyId', storyId);
    formData.append('type', 'cover');

    const res = await fetch('/api/story/upload-drawing', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '이미지 업로드에 실패했습니다.');
    }

    const { url } = await res.json();
    setUploadedImageUrl(url);
    return url;
  };

  const buildCharacterRefs = (): CharacterRef[] => {
    if (!story?.character_designs) return [];

    return story.character_designs
      .filter((character) => character.imageUrl)
      .map((character) => ({
        name: character.name,
        imageUrl: character.imageUrl!,
      }));
  };

  const getMatchedCharacterRefs = () => {
    const allRefs = buildCharacterRefs();
    const sourceText = `${title}\n${coverDescription}`.toLowerCase();
    const matched = allRefs.filter((ref) => sourceText.includes(ref.name.toLowerCase()));

    return {
      allRefs,
      matchedRefs: matched,
      matchedNames: matched.map((ref) => ref.name),
    };
  };

  const resetGeneratedCoverIfNeeded = () => {
    if (coverImageMode !== 'describe') {
      return;
    }

    setGeneratedCoverUrl(null);
    setCoverPreviewUrl(null);
  };

  const generateCoverImage = async (): Promise<string> => {
    if (!storyId || !story) {
      throw new Error('표지 생성을 위한 이야기 정보를 찾지 못했어요.');
    }
    if (!coverDescription.trim()) {
      throw new Error('표지 설명을 먼저 입력해 주세요.');
    }

    setCoverGenerating(true);
    setError(null);

    try {
      const style = normalizeIllustrationStyle(story.illustration_style);
      const styleOption = getIllustrationStyleOption(style);
      const pictureBookShapeOption = getPictureBookShapeOption(pictureBookShape);
      const { allRefs, matchedRefs, matchedNames } = getMatchedCharacterRefs();
      const characterInstruction = matchedNames.length > 0
        ? `표지 설명에 언급된 인물은 ${matchedNames.join(', ')}입니다. 같은 이름의 첨부 캐릭터 레퍼런스를 우선 참고해서 동일한 인물로 표현해 주세요.`
        : '첨부된 캐릭터 레퍼런스가 있다면 인물 디자인의 일관성을 참고해 주세요.';
      const coverTitle = title.trim() || '나만의 이야기';
      const coverAuthor = author.trim() || '작성자';
      const prompt = `평면 표지 아트워크 생성. 그림책 형태는 ${pictureBookShapeOption.label}이며 목표 비율은 ${pictureBookShapeOption.aspectRatio}입니다. ${pictureBookShapeOption.promptLabel}에 맞는 구도로 구성해주세요. 반드시 ${styleOption.label} 스타일로 표현해주세요. 스타일 표현 키워드: ${styleOption.promptLabel}. 첨부된 레퍼런스 이미지는 ${styleOption.label} 스타일의 디자인 감각만 참고하고, 인물이나 구성은 따라 하지 마세요. 책 실물, 목업, 포스터, 액자, 페이지 형태로 만들지 말고 표지 그림 자체만 만들어 주세요. 스파인이나 입체적인 책 형태는 넣지 마세요. 표지 설명: ${coverDescription.trim()}. ${characterInstruction} 표지 제목에 다음 텍스트 구현: ${coverTitle}. 제목 아래 더 작은 글씨로 다음 텍스트 구현: 글: ${coverAuthor}, 그림: ${coverAuthor}. 텍스트는 표지 디자인 안에 자연스럽게 배치해 주세요. 다른 요소를 임의로 추가하지 마세요.`;

      const response = await fetch('/api/story/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style_key: style,
          character_refs: matchedRefs.length > 0 ? matchedRefs : allRefs,
          matched_character_names: matchedNames,
          allow_text: true,
          cover_mode: true,
          aspect_ratio: pictureBookShapeOption.aspectRatio,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.image_url) {
        throw new Error(data.error || '표지 생성에 실패했어요.');
      }

      setGeneratedCoverUrl(data.image_url);
      setCoverPreviewUrl(data.image_url);
      return data.image_url as string;
    } finally {
      setCoverGenerating(false);
    }
  };

  const persistCover = async (targetStep?: number) => {
    if (!storyId || !story) return { success: false };

    let imageUrl: string | undefined;
    if (coverImageMode === 'upload' && (coverFile || uploadedImageUrl)) {
      const url = await uploadCoverImage();
      if (url) imageUrl = url;
    }

    const coverDesign: CoverDesign = {
      title: title.trim(),
      author: author.trim(),
      picture_book_shape: pictureBookShape,
    };

    if (coverImageMode === 'upload' && imageUrl) {
      coverDesign.image_url = imageUrl;
    }
    if (coverImageMode === 'describe' && coverDescription.trim()) {
      coverDesign.description = coverDescription.trim();
    }

    const updatePayload: Record<string, unknown> = {
      cover_design: coverDesign,
    };

    if (coverImageMode === 'upload') {
      updatePayload.cover_image_url = imageUrl ?? uploadedImageUrl ?? null;
    } else if (coverImageMode === 'describe') {
      updatePayload.cover_image_url = generatedCoverUrl ?? null;
    } else {
      updatePayload.cover_image_url = null;
    }

    if (typeof targetStep === 'number') {
      updatePayload.current_step = Math.max(story.current_step, targetStep);
      if (targetStep >= 7) {
        updatePayload.production_status = 'pending';
      }
    }

    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('stories')
      .update(updatePayload)
      .eq('id', storyId);

    if (updateError) {
      throw updateError;
    }

    return { success: true };
  };

  // Save and navigate
  const handleSubmit = async () => {
    if (!storyId || !title.trim()) return;
    if (coverImageMode === 'describe' && !generatedCoverUrl) {
      setError('표지를 먼저 생성한 뒤 다음 단계로 이동해 주세요.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      await persistCover(7);

      router.push(`/book/${bookId}/mystory/creating?storyId=${storyId}`);
    } catch (err) {
      console.error('Save error:', err);
      setError('저장에 실패했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  const handleStepSelect = async (targetStep: number) => {
    if (!storyId || !story) return;
    if (targetStep > 6 && !title.trim()) {
      setError('제목을 입력해 주세요.');
      return;
    }
    if (targetStep > 6 && coverImageMode === 'describe' && !generatedCoverUrl) {
      setError('표지를 먼저 생성한 뒤 다음 단계로 이동해 주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await persistCover(targetStep);
      router.push(getStepRouteWithLang(bookId, targetStep, storyId, story.language));
    } catch (err) {
      console.error('Step navigation save error:', err);
      setError('저장에 실패했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  // Clean up blob URL
  useEffect(() => {
    return () => {
      if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  if (saving) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" message="표지를 저장하고 있어요..." />
      </main>
    );
  }

  const isFormValid =
    title.trim().length > 0 &&
    (coverImageMode !== 'describe' || generatedCoverUrl !== null);

  return (
    <>
      <MyStoryStepSidebar currentStep={6} busy={saving} onStepSelect={handleStepSelect} />
      <main className="flex-1 px-4 py-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold text-foreground"
        >
          표지 디자인
        </motion.h1>
        <p className="text-sm text-muted mt-2">
          표지를 꾸며 보세요
        </p>
        <p className="text-xs text-gray-400 mt-1">Step 5/7</p>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Cover Design */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-10"
      >
        <h2 className="text-lg font-bold text-foreground mb-4">
          표지 디자인
        </h2>

        {/* Title */}
        <div className="mb-4">
          <label
            htmlFor="cover-title"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            제목 <span className="text-error">*</span>
          </label>
          <input
            id="cover-title"
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              resetGeneratedCoverIfNeeded();
            }}
            placeholder="나만의 이야기 제목을 입력하세요"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
            maxLength={50}
          />
        </div>

        {/* Author */}
        <div className="mb-6">
          <label
            htmlFor="cover-author"
            className="block text-sm font-medium text-foreground mb-1.5"
          >
            글쓴이
          </label>
          <input
            id="cover-author"
            type="text"
            value={author}
            onChange={(e) => {
              setAuthor(e.target.value);
              resetGeneratedCoverIfNeeded();
            }}
            placeholder="글쓴이 이름"
            className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
            maxLength={30}
          />
        </div>

        <div className="mb-6">
          <p className="text-sm font-medium text-foreground mb-3">
            그림책 형태
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            {PICTURE_BOOK_SHAPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setPictureBookShape(option.value);
                  resetGeneratedCoverIfNeeded();
                }}
                className={[
                  'rounded-xl border px-4 py-3 text-center transition-all',
                  pictureBookShape === option.value
                    ? 'border-secondary bg-secondary/10 text-foreground'
                    : 'border-border bg-card text-muted hover:border-muted hover:text-foreground',
                ].join(' ')}
              >
                <div className="text-sm font-semibold">
                  {PICTURE_BOOK_SHAPE_BUTTON_LABELS[option.value]}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cover Image */}
        <div>
          <p className="text-sm font-medium text-foreground mb-3">
            표지 이미지
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {(
              [
                { mode: 'upload' as CoverImageMode, label: '직접 그린 그림 올리기' },
                { mode: 'describe' as CoverImageMode, label: '표지 장면 설명하고 생성하기' },
                { mode: 'skip' as CoverImageMode, label: '이미지 없이 넘어가기' },
              ] as const
            ).map(({ mode, label }) => (
              <button
                key={mode}
                onClick={() => {
                  setCoverImageMode(mode);
                  if (mode !== 'upload') {
                    setCoverFile(null);
                    if (coverPreviewUrl?.startsWith('blob:')) {
                      URL.revokeObjectURL(coverPreviewUrl);
                    }
                    setCoverPreviewUrl(mode === 'describe' ? generatedCoverUrl : null);
                  }
                  if (mode === 'upload') {
                    setGeneratedCoverUrl(null);
                  }
                  if (mode === 'skip') {
                    setGeneratedCoverUrl(null);
                    setUploadedImageUrl(null);
                    setCoverPreviewUrl(null);
                  }
                }}
                className={`
                  px-3.5 py-2 rounded-lg text-xs font-medium transition-all border
                  ${
                    coverImageMode === mode
                      ? 'bg-secondary text-white border-secondary'
                      : 'bg-card text-muted border-border hover:border-muted hover:text-foreground'
                  }
                `}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Upload mode */}
          {coverImageMode === 'upload' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {coverPreviewUrl ? (
                <div className="relative">
                  <img
                    src={coverPreviewUrl}
                    alt="표지 미리보기"
                    className="w-full max-h-80 object-contain rounded-xl border border-border bg-white"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 text-xs text-secondary hover:text-secondary-dark font-medium transition-colors"
                  >
                    다른 이미지로 변경
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-10 border-2 border-dashed border-border rounded-xl text-muted hover:border-secondary hover:text-secondary transition-all flex flex-col items-center gap-2"
                >
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                    />
                  </svg>
                  <span className="text-sm font-medium">
                    이미지를 선택하세요
                  </span>
                </button>
              )}
            </motion.div>
          )}

          {/* Describe mode */}
          {coverImageMode === 'describe' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <textarea
                value={coverDescription}
                onChange={(e) => {
                  setCoverDescription(e.target.value);
                  resetGeneratedCoverIfNeeded();
                }}
                placeholder="표지에 어떤 장면을 그리고 싶은지 설명해 주세요. 예: 주인공이 숲속에서 동물 친구들과 함께 웃고 있는 장면"
                rows={3}
                className="w-full px-4 py-3 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all resize-none"
                maxLength={300}
              />
              <p className="text-right text-xs text-muted mt-1">
                {coverDescription.length}/300
              </p>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void generateCoverImage()}
                  disabled={coverGenerating || !coverDescription.trim()}
                  className="rounded-xl bg-secondary px-4 py-2.5 text-sm font-bold text-white hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {coverGenerating ? '표지 생성 중...' : generatedCoverUrl ? '표지 다시 생성하기' : '표지 생성하기'}
                </button>
                <p className="text-xs text-muted">
                  표지를 먼저 생성한 뒤 다음 단계로 이동할 수 있어요.
                </p>
              </div>

              {coverPreviewUrl && (
                <div className="mt-4">
                  <img
                    src={coverPreviewUrl}
                    alt="생성된 표지 미리보기"
                    className="w-full max-h-80 object-contain rounded-xl border border-border bg-white"
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* Skip mode */}
          {coverImageMode === 'skip' && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted bg-muted-light rounded-xl px-4 py-3"
            >
              표지 이미지를 나중에 직접 추가하지 않고, 이미지 없이 다음 단계로 넘어갑니다.
            </motion.p>
          )}
        </div>
      </motion.section>

      {/* Submit */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center pb-8"
      >
        <motion.button
          whileHover={{ scale: isFormValid ? 1.02 : 1 }}
          whileTap={{ scale: isFormValid ? 0.98 : 1 }}
          onClick={handleSubmit}
          disabled={!isFormValid || saving}
          className={`
            px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-lg
            ${
              isFormValid
                ? 'bg-accent text-white hover:bg-accent-dark shadow-accent/20 cursor-pointer'
                : 'bg-border text-muted cursor-not-allowed shadow-none'
            }
          `}
        >
          {coverImageMode === 'describe' && !generatedCoverUrl
            ? '표지를 먼저 생성해 주세요'
            : '다음 단계로 이동'}
        </motion.button>
      </motion.div>
      </main>
    </>
  );
}
