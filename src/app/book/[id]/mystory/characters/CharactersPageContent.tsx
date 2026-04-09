'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StepProgress from '@/components/story/StepProgress';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Story, IllustrationStyle, CharacterDesign } from '@/types/database';

/* ── Constants ── */

const MAX_CHARACTERS = 3;

interface StyleOption {
  value: IllustrationStyle;
  icon: string;
  label: string;
  description: string;
}

const STYLE_OPTIONS: StyleOption[] = [
  {
    value: 'colored_pencil',
    icon: '\uD83D\uDD8D\uFE0F',
    label: '\uC0C9\uC5F0\uD544',
    description: '\uB530\uB73B\uD558\uACE0 \uBD80\uB4DC\uB7EC\uC6B4 \uC0C9\uC5F0\uD544 \uB290\uB08C\uC758 \uADF8\uB9BC',
  },
  {
    value: 'watercolor',
    icon: '\uD83C\uDFA8',
    label: '\uC218\uCC44\uD654',
    description: '\uBB3C\uAC10\uC774 \uBC88\uC9C0\uB294 \uD22C\uBA85\uD55C \uC218\uCC44\uD654 \uB290\uB08C',
  },
  {
    value: 'woodblock',
    icon: '\uD83E\uDEB5',
    label: '\uD310\uD654',
    description: '\uC120\uC774 \uAD75\uACE0 \uB300\uBE44\uAC00 \uAC15\uD55C \uD310\uD654 \uB290\uB08C',
  },
  {
    value: 'pastel',
    icon: '\uD83C\uDF38',
    label: '\uD30C\uC2A4\uD154',
    description: '\uBD80\uB4DC\uB7FD\uACE0 \uBABD\uD658\uC801\uC778 \uD30C\uC2A4\uD154 \uD1A4',
  },
];

const STYLE_PROMPT_MAP: Record<IllustrationStyle, string> = {
  colored_pencil: 'colored pencil illustration',
  watercolor: 'watercolor painting illustration',
  woodblock: 'woodblock print illustration',
  pastel: 'soft pastel illustration',
};

const STEP_ROUTES: Record<number, string> = {
  1: '',
  2: '/write',
  3: '/draft',
  4: '/scenes',
  5: '/characters',
  6: '/style',
  7: '/creating',
  8: '/finish',
};

function getStepRedirect(
  bookId: string,
  currentStep: number,
  storyId: string,
): string {
  const route = STEP_ROUTES[currentStep] ?? '';
  return `/book/${bookId}/mystory${route}?storyId=${storyId}`;
}

function createEmptyCharacter(): CharacterDesign {
  return { name: '', appearance: '', personality: '', imageUrl: null };
}

/* ── Main Component ── */

export default function CharactersPageContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookId = params.id as string;
  const storyId = searchParams.get('storyId');
  const router = useRouter();
  const { loading: authLoading } = useAuth();

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Art style
  const [selectedStyle, setSelectedStyle] = useState<IllustrationStyle>('colored_pencil');

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
      const supabase = createClient();
      const { data } = await supabase
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .single();

      if (data) {
        const s = data as Story;
        setStory(s);

        // Guard: redirect to earlier step if not ready
        if (s.current_step < 5) {
          router.replace(getStepRedirect(bookId, s.current_step, storyId));
          return;
        }

        // Pre-fill from existing data
        if (s.illustration_style) {
          setSelectedStyle(s.illustration_style);
        }
        if (s.character_designs && s.character_designs.length > 0) {
          setCharacters(s.character_designs);
        }
      }
      setLoading(false);
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
      const styleLabel = STYLE_PROMPT_MAP[selectedStyle];
      const personalityPart = character.personality.trim()
        ? `, personality: ${character.personality.trim()}`
        : '';
      const prompt = `Character sheet, ${styleLabel} style, white background only, full body, children's picture book illustration, ${character.appearance.trim()}${personalityPart}`;

      const res = await fetch('/api/story/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
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

  // Save and navigate to next step
  const handleNext = async () => {
    if (!storyId) return;

    // Validate at least one character with a name
    const validCharacters = characters.filter((c) => c.name.trim());
    if (validCharacters.length === 0) {
      setError('최소 1명의 주인공 이름을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('stories')
        .update({
          character_designs: validCharacters,
          illustration_style: selectedStyle,
          current_step: 6,
        })
        .eq('id', storyId);

      if (updateError) throw updateError;

      router.push(`/book/${bookId}/mystory/style?storyId=${storyId}`);
    } catch (err) {
      console.error('Save error:', err);
      setError('저장에 실패했어요. 다시 시도해 주세요.');
      setSaving(false);
    }
  };

  /* ── Render ── */

  if (authLoading || loading) {
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
    <main className="flex-1 px-4 py-6 max-w-3xl mx-auto">
      {/* Step Progress */}
      <StepProgress currentStep={5} />

      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <p className="text-sm text-muted mb-1">Step 5/8</p>
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
        <h2 className="text-lg font-bold text-foreground mb-1">
          그림 스타일 선택
        </h2>
        <p className="text-xs text-muted mb-4">
          캐릭터 시트에 적용될 그림 스타일을 골라 주세요
        </p>

        <div className="grid grid-cols-2 gap-3">
          {STYLE_OPTIONS.map((option) => {
            const isSelected = selectedStyle === option.value;
            return (
              <motion.button
                key={option.value}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedStyle(option.value)}
                className={`
                  relative p-4 rounded-xl border-2 text-left transition-all
                  ${
                    isSelected
                      ? 'border-secondary bg-secondary/5 shadow-md shadow-secondary/10'
                      : 'border-border bg-card hover:border-muted hover:bg-card-hover'
                  }
                `}
              >
                {isSelected && (
                  <motion.div
                    layoutId="style-check-char"
                    className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-secondary flex items-center justify-center"
                  >
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </motion.div>
                )}
                <span className="text-2xl block mb-2">{option.icon}</span>
                <span
                  className={`text-sm font-bold block mb-1 ${
                    isSelected ? 'text-secondary' : 'text-foreground'
                  }`}
                >
                  {option.label}
                </span>
                <span className="text-xs text-muted leading-relaxed">
                  {option.description}
                </span>
              </motion.button>
            );
          })}
        </div>
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
          {saving ? '저장 중...' : '표지 만들러 가기 \u2192'}
        </motion.button>
      </motion.div>
    </main>
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
