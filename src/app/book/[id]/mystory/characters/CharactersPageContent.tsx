'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import StepProgress from '@/components/story/StepProgress';
import { createClient } from '@/lib/supabase/client';
import type { Story, IllustrationStyle, CharacterDesign, CharacterGender } from '@/types/database';
import { ILLUSTRATION_STYLE_OPTIONS, getIllustrationStyleOption, normalizeIllustrationStyle } from '@/lib/illustration-styles';
import { getStepRouteWithLang } from '@/lib/mystory-steps';

/* ── Constants ── */

const MAX_CHARACTERS = 3;

const GENDER_OPTIONS: Array<{ value: CharacterGender; label: string }> = [
  { value: 'unspecified', label: '미정' },
  { value: 'female', label: '여성' },
  { value: 'male', label: '남성' },
];

const GENDER_PROMPT_LABELS: Record<CharacterGender, string> = {
  unspecified: '',
  female: 'female',
  male: 'male',
};

function createEmptyCharacter(): CharacterDesign {
  return { name: '', gender: 'unspecified', appearance: '', personality: '', imageUrl: null };
}

function normalizeCharacterDesign(character: Partial<CharacterDesign> | null | undefined): CharacterDesign {
  const safeGender = character?.gender;
  const gender: CharacterGender =
    safeGender === 'female' || safeGender === 'male'
      ? safeGender
      : 'unspecified';

  return {
    name: character?.name ?? '',
    gender,
    appearance: character?.appearance ?? '',
    personality: character?.personality ?? '',
    imageUrl: character?.imageUrl ?? null,
  };
}

function hasMeaningfulCharacter(character: CharacterDesign) {
  return (
    character.name.trim().length > 0 ||
    character.appearance.trim().length > 0 ||
    character.personality.trim().length > 0 ||
    character.imageUrl !== null
  );
}

/* ── Main Component ── */

export default function CharactersPageContent({ storyId }: { storyId: string | null }) {
  const params = useParams();
  const bookId = params.id as string;
  const router = useRouter();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Art style
  const [selectedStyle, setSelectedStyle] = useState<IllustrationStyle>('watercolor');
  const [showStyleGallery, setShowStyleGallery] = useState(true);
  const [expandedStyleImage, setExpandedStyleImage] = useState<IllustrationStyle | null>(null);

  // Characters
  const [characters, setCharacters] = useState<CharacterDesign[]>([
    createEmptyCharacter(),
  ]);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

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

          // Guard: character step needs story text first
          if (!s.final_text || s.final_text.length === 0) {
            router.replace(`/book/${bookId}/mystory/draft?storyId=${storyId}&lang=${s.language}`);
            return;
          }

          // Pre-fill from existing data
          if (s.illustration_style) {
            setSelectedStyle(normalizeIllustrationStyle(s.illustration_style));
          }
          if (s.character_designs && s.character_designs.length > 0) {
            setCharacters(s.character_designs.map((character: CharacterDesign) => normalizeCharacterDesign(character)));
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [storyId, bookId, router]);

  // Update a single character field
  const updateCharacter = useCallback(
    (index: number, updates: Partial<CharacterDesign>) => {
      setCharacters((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
      });
    },
    [],
  );

  // Add new character
  const addCharacter = useCallback(() => {
    setCharacters((prev) => {
      if (prev.length >= MAX_CHARACTERS) return prev;
      return [...prev, createEmptyCharacter()];
    });
  }, []);

  // Remove a character
  const removeCharacter = useCallback(
    (index: number) => {
      setCharacters((prev) => {
        if (prev.length <= 1) return prev;
        return prev.filter((_, i) => i !== index);
      });
    },
    [],
  );

  // Generate character sheet image
  const handleGenerate = async (index: number) => {
    const character = characters[index];
    if (!character.name.trim() || !character.appearance.trim()) {
      setError('캐릭터 이름과 외형 설명을 입력해 주세요.');
      return;
    }

    setError(null);
    setGeneratingIndex(index);

    try {
      const styleOption = getIllustrationStyleOption(selectedStyle);
      const styleLabel = styleOption.promptLabel;
      const styleName = styleOption.label;
      const genderLabel = GENDER_PROMPT_LABELS[character.gender];
      const genderPart = genderLabel ? `, gender presentation: ${genderLabel}` : '';
      const personalityPart = character.personality.trim()
        ? `, personality: ${character.personality.trim()}`
        : '';
      const prompt = `캐릭터 시트 생성. 반드시 ${styleName} 스타일로 표현해주세요. 스타일 표현 키워드: ${styleLabel}. 첨부된 레퍼런스 이미지는 ${styleName} 스타일의 디자인 감각을 참고하는 용도이며, 인물, 구도, 구성은 따라 하지 마세요. 전신이 모두 보이게, 흰 배경 위에 한 인물만 그려주세요. 인물의 포즈와 표정이 잘 드러나게 해주세요. ${character.appearance.trim()}${genderPart}${personalityPart}. 텍스트는 넣지 마세요. 예시에 없는 다른 요소는 재현하지 마세요. 다른 인물은 등장시키지 마세요.`;

      const res = await fetch('/api/story/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          style_key: selectedStyle,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || '이미지 생성에 실패했어요.');
      }

      const { image_url } = await res.json();
      updateCharacter(index, { imageUrl: image_url });
    } catch (err) {
      console.error('Character generation error:', err);
      setError(
        err instanceof Error
          ? err.message
          : '캐릭터 시트 생성에 실패했어요. 다시 시도해 주세요.',
      );
    } finally {
      setGeneratingIndex(null);
    }
  };

  const saveCharacters = useCallback(async (targetStep: number) => {
    if (!storyId || !story) {
      throw new Error('Story not found');
    }

    const normalizedCharacters = characters
      .map((character) => normalizeCharacterDesign(character))
      .filter((character) => hasMeaningfulCharacter(character));
    const validCharacters = normalizedCharacters.filter((character) => character.name.trim());

    if (validCharacters.length === 0) {
      throw new Error('최소 1명의 주인공 이름을 입력해 주세요.');
    }

    const supabase = createClient();
    const { data: updatedStory, error: updateError } = await supabase
      .from('stories')
      .update({
        character_designs: normalizedCharacters,
        illustration_style: selectedStyle,
        current_step: Math.max(story.current_step, targetStep),
      })
      .eq('id', storyId)
      .select('id, current_step, language, character_designs')
      .single();

    if (updateError) {
      throw updateError;
    }

    const persistedCharacters = Array.isArray(updatedStory?.character_designs)
      ? updatedStory.character_designs.filter((character: CharacterDesign) =>
          typeof character?.name === 'string' && character.name.trim().length > 0
        )
      : [];

    if (persistedCharacters.length === 0) {
      throw new Error('주인공 저장을 확인하지 못했어요.');
    }

    return updatedStory;
  }, [characters, selectedStyle, story, storyId]);

  // Save and navigate to next step
  const handleNext = async () => {
    if (!storyId || !story) return;

    setSaving(true);
    setError(null);

    try {
      const updatedStory = await saveCharacters(6);
      router.push(getStepRouteWithLang(bookId, 6, storyId, updatedStory.language));
    } catch (err) {
      console.error('Save error:', err);
      setError(
        err instanceof Error
          ? err.message
          : '저장에 실패했어요. 다시 시도해 주세요.'
      );
      setSaving(false);
    }
  };

  const handleStepSelect = useCallback(async (targetStep: number) => {
    if (!storyId || !story) return;

    setSaving(true);
    setError(null);

    try {
      const updatedStory = await saveCharacters(targetStep);
      router.push(getStepRouteWithLang(bookId, targetStep, storyId, updatedStory.language));
    } catch (err) {
      console.error('Step navigation save error:', err);
      setError(
        err instanceof Error
          ? err.message
          : '저장에 실패했어요. 다시 시도해 주세요.'
      );
      setSaving(false);
    }
  }, [bookId, router, saveCharacters, story, storyId]);

  /* ── Render ── */

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  if (!story) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[60vh]">
        <p className="text-muted">이야기를 찾을 수 없습니다.</p>
      </main>
    );
  }

  const canSubmit =
    characters.some((c) => c.name.trim()) && !saving && generatingIndex === null;

  return (
    <>
      <MyStoryStepSidebar currentStep={5} busy={saving || generatingIndex !== null} onStepSelect={handleStepSelect} />
      <main className="flex-1 px-4 py-6 max-w-3xl mx-auto">
      {/* Step Progress */}
      <StepProgress currentStep={5} />

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <p className="text-sm text-muted mb-1">Step 4/7</p>
        <h1 className="text-2xl font-bold text-foreground">주인공 설정</h1>
        <p className="text-sm text-muted mt-2">
          이야기에 등장할 주인공을 만들어 보세요
        </p>
      </motion.div>

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          {error}
        </motion.div>
      )}

      {/* Section 1: Art Style */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-10"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-1">
              그림 스타일 선택
            </h2>
            <p className="text-xs text-muted">
              예시 이미지를 보고 스타일을 고르세요. 선택한 스타일은 주인공 생성과 최종 작품 제작에 함께 적용돼요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowStyleGallery((prev) => !prev)}
            className="mt-2 shrink-0 rounded-xl border border-border bg-white px-3 py-2 text-xs font-medium text-foreground hover:bg-gray-50"
          >
            {showStyleGallery ? '접기' : '스타일 보기'}
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowStyleGallery((prev) => !prev)}
          className="mb-4 w-full rounded-2xl border border-secondary/20 bg-secondary/5 p-4 text-left transition-colors hover:bg-secondary/10"
        >
          <p className="text-xs font-medium text-secondary mb-2">선택한 스타일</p>
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl border border-secondary/20 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getIllustrationStyleOption(selectedStyle).exampleImagePath}
                alt={getIllustrationStyleOption(selectedStyle).label}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-foreground">
                {getIllustrationStyleOption(selectedStyle).icon} {getIllustrationStyleOption(selectedStyle).label}
              </p>
              <p className="text-xs text-muted mt-1">
                {getIllustrationStyleOption(selectedStyle).description}
              </p>
            </div>
            <span className="text-xs font-medium text-secondary">
              {showStyleGallery ? '접기' : '열기'}
            </span>
          </div>
        </button>

        {showStyleGallery && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {ILLUSTRATION_STYLE_OPTIONS.map((option) => {
              const isSelected = selectedStyle === option.value;
              return (
                <motion.div
                  key={option.value}
                  whileHover={{ scale: 1.02 }}
                  className={`
                    relative overflow-hidden rounded-2xl border-2 transition-all
                    ${
                      isSelected
                        ? 'border-secondary bg-secondary/5 shadow-md shadow-secondary/10'
                        : 'border-border bg-card hover:border-muted hover:bg-card-hover'
                    }
                  `}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStyle(option.value);
                      setShowStyleGallery(false);
                    }}
                    className="block w-full text-left"
                  >
                    <div className="relative aspect-[4/3] w-full bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={option.exampleImagePath}
                      alt={`${option.label} 예시`}
                      className="h-full w-full object-cover"
                    />
                    </div>
                    <div className="p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-lg">{option.icon}</span>
                        <span className={`text-sm font-bold ${isSelected ? 'text-secondary' : 'text-foreground'}`}>
                          {option.label}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted">{option.description}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpandedStyleImage(option.value)}
                    className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2.5 py-1 text-[11px] font-medium text-white"
                  >
                    확대
                  </button>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.section>

      {/* Section 2: Character Design Cards */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-10"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              주인공 디자인
            </h2>
            <p className="text-xs text-muted mt-0.5">
              최소 1명, 최대 {MAX_CHARACTERS}명까지 만들 수 있어요
            </p>
          </div>
          <span className="text-xs text-muted font-medium bg-muted-light px-2.5 py-1 rounded-full">
            {characters.length}/{MAX_CHARACTERS}
          </span>
        </div>

        <div className="flex flex-col gap-5">
          {characters.map((character, index) => (
            <CharacterCard
              key={index}
              index={index}
              character={character}
              canRemove={characters.length > 1}
              isGenerating={generatingIndex === index}
              anyGenerating={generatingIndex !== null}
              onUpdate={(updates) => updateCharacter(index, updates)}
              onRemove={() => removeCharacter(index)}
              onGenerate={() => void handleGenerate(index)}
            />
          ))}
        </div>

        {/* Add character button */}
        {characters.length < MAX_CHARACTERS && (
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={addCharacter}
            className="mt-4 w-full py-3.5 border-2 border-dashed border-border rounded-xl
              text-muted hover:border-secondary hover:text-secondary transition-all
              flex items-center justify-center gap-2 text-sm font-medium"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            주인공 추가
          </motion.button>
        )}
      </motion.section>

      {/* Section 3: Navigate */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex justify-center pb-8"
      >
        <motion.button
          type="button"
          whileHover={{ scale: canSubmit ? 1.02 : 1 }}
          whileTap={{ scale: canSubmit ? 0.98 : 1 }}
          onClick={() => void handleNext()}
          disabled={!canSubmit}
          className={`
            px-10 py-4 rounded-xl text-lg font-bold transition-all shadow-lg
            ${
              canSubmit
                ? 'bg-accent text-white hover:bg-accent-dark shadow-accent/20 cursor-pointer'
                : 'bg-border text-muted cursor-not-allowed shadow-none'
            }
          `}
        >
          {saving ? '저장 중...' : '표지 만들러 가기'}
        </motion.button>
      </motion.div>
      {expandedStyleImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setExpandedStyleImage(null)}
        >
          <div
            className="relative w-full max-w-4xl overflow-hidden rounded-3xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedStyleImage(null)}
              className="absolute right-4 top-4 rounded-full bg-black/70 px-3 py-1 text-sm font-medium text-white"
            >
              닫기
            </button>
            <div className="mb-3">
              <p className="text-lg font-bold text-foreground">
                {getIllustrationStyleOption(expandedStyleImage).label} 예시
              </p>
              <p className="text-sm text-muted mt-1">
                이 이미지는 스타일과 디자인 감각만 참고합니다.
              </p>
            </div>
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={getIllustrationStyleOption(expandedStyleImage).exampleImagePath}
                alt={`${getIllustrationStyleOption(expandedStyleImage).label} 확대 예시`}
                className="h-full w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
      </main>
    </>
  );
}

/* ── CharacterCard ── */

function CharacterCard({
  index,
  character,
  canRemove,
  isGenerating,
  anyGenerating,
  onUpdate,
  onRemove,
  onGenerate,
}: {
  index: number;
  character: CharacterDesign;
  canRemove: boolean;
  isGenerating: boolean;
  anyGenerating: boolean;
  onUpdate: (updates: Partial<CharacterDesign>) => void;
  onRemove: () => void;
  onGenerate: () => void;
}) {
  const canGenerate =
    character.name.trim().length > 0 &&
    character.appearance.trim().length > 0 &&
    !anyGenerating;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
    >
      {/* Card header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-secondary/10 text-secondary text-xs font-bold">
            {index + 1}
          </span>
          <span className="text-sm font-bold text-foreground">
            주인공 {index + 1}
          </span>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-muted hover:text-red-500 transition-colors p-1"
            title="삭제"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Name */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-foreground mb-1.5">
          이름 <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={character.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="예: 아리아"
          maxLength={30}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm
            placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-secondary/30
            focus:border-secondary transition-all"
        />
      </div>

      {/* Appearance */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-foreground mb-1.5">
          성별
        </label>
        <select
          value={character.gender}
          onChange={(e) => onUpdate({ gender: e.target.value as CharacterGender })}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm
            focus:outline-none focus:ring-2 focus:ring-secondary/30 focus:border-secondary transition-all"
        >
          {GENDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* Appearance */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-foreground mb-1.5">
          외형 설명 <span className="text-red-500">*</span>
        </label>
        <textarea
          value={character.appearance}
          onChange={(e) => onUpdate({ appearance: e.target.value })}
          placeholder="예: 갈색 피부, 긴 머리, 전통 옷 입은 소녀"
          rows={2}
          maxLength={200}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm
            placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-secondary/30
            focus:border-secondary transition-all resize-none"
        />
      </div>

      {/* Personality */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-foreground mb-1.5">
          성격/특징 <span className="text-xs text-muted">(선택)</span>
        </label>
        <input
          type="text"
          value={character.personality}
          onChange={(e) => onUpdate({ personality: e.target.value })}
          placeholder="예: 용감하고 호기심이 많음"
          maxLength={100}
          className="w-full px-4 py-2.5 rounded-xl border border-border bg-white text-foreground text-sm
            placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-secondary/30
            focus:border-secondary transition-all"
        />
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={!canGenerate}
        className={`
          w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2
          ${
            canGenerate
              ? 'bg-secondary text-white hover:bg-secondary-dark cursor-pointer'
              : 'bg-border text-muted cursor-not-allowed'
          }
        `}
      >
        {isGenerating ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            생성 중...
          </>
        ) : (
          <>
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
            캐릭터 시트 생성하기
          </>
        )}
      </button>

      {/* Generated image preview */}
      {character.imageUrl && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4"
        >
          <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-border bg-white">
            <Image
              src={character.imageUrl}
              alt={`${character.name} 캐릭터 시트`}
              fill
              className="object-contain"
              sizes="(max-width: 768px) 100vw, 672px"
            />
          </div>
          <p className="text-xs text-muted text-center mt-2">
            {character.name} 캐릭터 시트
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
