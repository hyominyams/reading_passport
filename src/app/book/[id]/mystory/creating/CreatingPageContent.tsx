'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import { createClient } from '@/lib/supabase/client';
import type { Story, CountryFact } from '@/types/database';
import { getStepRouteWithLang } from '@/lib/mystory-steps';

const POLL_INTERVAL = 5000;
const CAROUSEL_INTERVAL = 5000;

const FALLBACK_FACTS: CountryFact[] = [
  {
    id: 'fallback-1',
    country_id: '',
    fact_text: '전 세계에는 약 7,000개의 언어가 사용되고 있어요!',
    fact_text_en: 'There are approximately 7,000 languages spoken around the world!',
    order: 1,
  },
  {
    id: 'fallback-2',
    country_id: '',
    fact_text: '지구에서 가장 긴 강은 나일강으로, 길이가 6,650km나 돼요!',
    fact_text_en: 'The longest river on Earth is the Nile, stretching 6,650 km!',
    order: 2,
  },
  {
    id: 'fallback-3',
    country_id: '',
    fact_text: '세계에서 가장 작은 나라는 바티칸 시국으로, 서울의 1/1700 크기예요!',
    fact_text_en: 'The smallest country in the world is Vatican City, about 1/1700 the size of Seoul!',
    order: 3,
  },
  {
    id: 'fallback-4',
    country_id: '',
    fact_text: '아프리카에는 54개의 나라가 있어요. 세계에서 나라가 가장 많은 대륙이에요!',
    fact_text_en: 'Africa has 54 countries, making it the continent with the most countries!',
    order: 4,
  },
  {
    id: 'fallback-5',
    country_id: '',
    fact_text: '세계에서 가장 높은 산은 에베레스트산으로, 높이가 8,849m예요!',
    fact_text_en: 'The tallest mountain in the world is Mt. Everest at 8,849 meters!',
    order: 5,
  },
];

function splitFactIntoLines(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return [];
  }

  const segments = normalized.match(/[^.]+\.(?:\s*|$)|[^.]+$/g);
  return (segments ?? [normalized])
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export default function CreatingPageContent({
  storyId,
  lang,
}: {
  storyId: string | null;
  lang: string;
}) {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>('pending');
  const [progress, setProgress] = useState(0);
  const [facts, setFacts] = useState<CountryFact[]>([]);
  const [factIndex, setFactIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const produceCalledRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const carouselTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch story data on mount
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
          setStatus(s.production_status);
          setProgress(s.production_progress);

          const hasCoverConfig =
            !!s.cover_design?.title || !!s.cover_design?.description || !!s.cover_design?.image_url;
          if (!hasCoverConfig && s.production_status === 'pending') {
            router.replace(`/book/${bookId}/mystory/style?storyId=${storyId}&lang=${s.language}`);
            return;
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchStory();
  }, [storyId]);

  // Fetch country facts
  useEffect(() => {
    const fetchFacts = async () => {
      if (!story?.country_id) {
        setFacts(FALLBACK_FACTS);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from('country_facts')
        .select('*')
        .eq('country_id', story.country_id)
        .order('order', { ascending: true });

      const fetched = (data ?? []) as CountryFact[];
      setFacts(fetched.length > 0 ? fetched : FALLBACK_FACTS);
    };
    fetchFacts();
  }, [story?.country_id]);

  // Auto-rotate carousel
  useEffect(() => {
    if (facts.length <= 1) return;

    carouselTimerRef.current = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % facts.length);
    }, CAROUSEL_INTERVAL);

    return () => {
      if (carouselTimerRef.current) {
        clearInterval(carouselTimerRef.current);
      }
    };
  }, [facts.length]);

  // Start production once on mount if status is pending
  const startProduction = useCallback(async () => {
    if (!storyId || produceCalledRef.current) return;
    produceCalledRef.current = true;

    try {
      const res = await fetch('/api/story/produce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setError(errData.error ?? 'Production failed to start');
      }
    } catch (err) {
      console.error('Failed to start production:', err);
      setError('Production failed to start');
    }
  }, [storyId]);

  useEffect(() => {
    if (!story || loading) return;

    if (story.production_status === 'pending') {
      startProduction();
    }
    // If already completed, redirect immediately
    if (story.production_status === 'completed') {
      router.replace(`/book/${bookId}/mystory/finish?storyId=${storyId}&lang=${lang}`);
    }
  }, [story, loading, startProduction, router, bookId, storyId, lang]);

  // Poll progress
  useEffect(() => {
    if (!storyId || status === 'completed') return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/story/progress?storyId=${storyId}`);
        if (res.ok) {
          const data = await res.json();
          setStatus(data.status);
          setProgress(data.progress);

          if (data.status === 'completed') {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
            }
            // Short delay before redirect so user sees 100%
            setTimeout(() => {
              router.replace(
                `/book/${bookId}/mystory/finish?storyId=${storyId}&lang=${lang}`
              );
            }, 1500);
          }

          if (data.status === 'failed') {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
            }
            setError('Image generation failed. Please try again.');
          }
        }
      } catch {
        // Silently retry on next interval
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [storyId, status, router, bookId, lang]);

  const handleRetry = async () => {
    if (!storyId) return;
    setError(null);
    setStatus('pending');
    setProgress(0);
    produceCalledRef.current = false;

    // Reset the production status in DB via client
    const supabase = createClient();
    await supabase
      .from('stories')
      .update({ production_status: 'pending', production_progress: 0 })
      .eq('id', storyId);

    startProduction();
  };

  const handleStepSelect = async (targetStep: number) => {
    if (!storyId || !story) return;

    if (targetStep === 8 && status !== 'completed') {
      setError(lang === 'en' ? 'The book is still being created.' : '아직 그림책 제작이 끝나지 않았어요.');
      return;
    }

    try {
      const supabase = createClient();
      await supabase
        .from('stories')
        .update({ current_step: Math.max(story.current_step, targetStep) })
        .eq('id', storyId);

      router.push(getStepRouteWithLang(bookId, targetStep, storyId, story.language));
    } catch (err) {
      console.error('Step navigation error:', err);
      setError(lang === 'en' ? 'Could not move to that step.' : '그 단계로 이동하지 못했어요.');
    }
  };

  const goToPrev = () => {
    setFactIndex((prev) => (prev - 1 + facts.length) % facts.length);
  };

  const goToNext = () => {
    setFactIndex((prev) => (prev + 1) % facts.length);
  };

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner message="Loading..." />
      </main>
    );
  }

  if (!storyId || !story) {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[60vh]">
        <p className="text-muted">Story not found.</p>
      </main>
    );
  }

  // Calculate completed / total for display
  // Images are generated from final_text (student's written text), not scene_descriptions
  const finalText = story.final_text ?? [];
  const uploadedImages = story.uploaded_images ?? [];

  let totalImages = 0;
  for (let i = 0; i < finalText.length; i++) {
    if (finalText[i] && !uploadedImages[i]) {
      totalImages++;
    }
  }

  const completedImages = Math.round((progress / 100) * totalImages);
  const factText = lang === 'en' && facts[factIndex]?.fact_text_en
    ? facts[factIndex].fact_text_en
    : facts[factIndex]?.fact_text;
  const factLines = splitFactIntoLines(factText);

  return (
    <>
      <main className="flex-1 px-4 py-8 max-w-lg mx-auto flex flex-col items-center">
      {/* Animated book icon */}
      <motion.div
        animate={{ rotate: [0, -5, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="text-6xl mb-6"
      >
        <span role="img" aria-label="book">
          {'📚'}
        </span>
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold text-foreground mb-2 text-center"
      >
        {lang === 'en'
          ? 'Creating your story...'
          : '이야기를 만들고 있어요...'}
      </motion.h1>

      <p className="text-sm text-muted mb-8 text-center">
        {lang === 'en'
          ? 'AI is illustrating your picture book. This may take a few minutes.'
          : 'AI가 그림책을 그리고 있어요. 잠시만 기다려 주세요!'}
      </p>

      {/* Progress bar */}
      <div className="w-full mb-3">
        <div className="h-4 bg-muted-light rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Progress text */}
      <p className="text-sm font-medium text-foreground mb-1">
        {totalImages > 0
          ? `${completedImages}/${totalImages} ${lang === 'en' ? 'done' : '완료'}`
          : lang === 'en'
            ? 'Preparing...'
            : '준비 중...'}
      </p>
      <p className="text-xs text-muted mb-8">{progress}%</p>

      {/* Error state */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-center"
        >
          <p className="text-sm text-red-600 mb-3">{error}</p>
          <button
            onClick={handleRetry}
            className="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors text-sm"
          >
            {lang === 'en' ? 'Retry' : '다시 시도'}
          </button>
        </motion.div>
      )}

      {/* Country facts carousel */}
      {facts.length > 0 && !error && (
        <div className="w-full">
          <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6 min-h-[160px] flex flex-col items-center justify-center">
            {/* Header */}
            <p className="text-xs font-semibold text-amber-600 mb-3 tracking-wide">
              {'🌍'}{' '}
              {lang === 'en'
                ? 'Did you know?'
                : '혹시 이거 알고 있나요?'}
            </p>

            {/* Fact text */}
            <AnimatePresence mode="wait">
              <motion.p
                key={facts[factIndex]?.id}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.3 }}
                className="text-sm text-foreground text-center leading-relaxed px-4"
              >
                {factLines.map((line, index) => (
                  <span key={`${facts[factIndex]?.id ?? 'fact'}-${index}`} className="block">
                    {line}
                  </span>
                ))}
              </motion.p>
            </AnimatePresence>

            {/* Navigation buttons */}
            {facts.length > 1 && (
              <>
                <button
                  onClick={goToPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 text-amber-600 hover:bg-white transition-colors shadow-sm"
                  aria-label="Previous fact"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 19.5L8.25 12l7.5-7.5"
                    />
                  </svg>
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 text-amber-600 hover:bg-white transition-colors shadow-sm"
                  aria-label="Next fact"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-4 h-4"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M8.25 4.5l7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Dots indicator */}
          {facts.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-3">
              {facts.map((fact, i) => (
                <button
                  key={fact.id}
                  onClick={() => setFactIndex(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === factIndex
                      ? 'bg-amber-500'
                      : 'bg-amber-200 hover:bg-amber-300'
                  }`}
                  aria-label={`Go to fact ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
      </main>
    </>
  );
}
