/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const COUNTRY_SLIDES = [
  { name: '콜롬비아', flag: '🇨🇴', desc: '커피와 음악의 나라', image: 'https://images.unsplash.com/photo-1536308037887-165852797016?w=800&h=500&fit=crop' },
  { name: '탄자니아', flag: '🇹🇿', desc: '킬리만자로의 나라', image: 'https://images.unsplash.com/photo-1525535816528-974e4b19eb51?w=800&h=500&fit=crop' },
  { name: '캄보디아', flag: '🇰🇭', desc: '앙코르와트의 나라', image: 'https://images.unsplash.com/photo-1504639650150-bf773680d8c3?w=800&h=500&fit=crop' },
  { name: '네팔', flag: '🇳🇵', desc: '히말라야의 나라', image: 'https://images.unsplash.com/photo-1668966780359-78fe21493d9b?w=800&h=500&fit=crop' },
  { name: '르완다', flag: '🇷🇼', desc: '천 개의 언덕 나라', image: 'https://images.unsplash.com/photo-1580060839134-75a5edca2e99?w=800&h=500&fit=crop' },
  { name: '케냐', flag: '🇰🇪', desc: '사파리의 나라', image: 'https://images.unsplash.com/photo-1554490752-6a232eca5e60?w=800&h=500&fit=crop' },
];

export default function HomeCountryCarousel() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % COUNTRY_SLIDES.length);
    }, 5000);
  }, []);

  useEffect(() => {
    startTimer();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [startTimer]);

  const goTo = useCallback((index: number) => {
    setCurrent(index);
    startTimer();
  }, [startTimer]);

  const prev = () => goTo((current - 1 + COUNTRY_SLIDES.length) % COUNTRY_SLIDES.length);
  const next = () => goTo((current + 1) % COUNTRY_SLIDES.length);

  const slide = COUNTRY_SLIDES[current];

  return (
    <section className="relative bg-white px-8 py-20 sm:px-12 sm:py-28 md:px-20 lg:px-28">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <p className="mb-3 text-[11px] font-heading font-medium uppercase tracking-[0.35em] text-muted sm:text-xs">
            Global Reading
          </p>
          <h2 className="text-2xl font-heading font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
            세계와 연결되는
            <br />
            <span className="text-muted">독서 경험</span>
          </h2>
        </div>

        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-gray-900">
          <img
            key={slide.image}
            src={slide.image}
            alt={slide.name}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
            <div className="mb-2 flex items-center gap-3">
              <span className="text-3xl">{slide.flag}</span>
              <h3 className="text-xl font-heading font-bold text-white sm:text-2xl">{slide.name}</h3>
            </div>
            <p className="text-sm text-white/70">{slide.desc}</p>
          </div>

          <button
            type="button"
            onClick={prev}
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            aria-label="이전 나라 보기"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            aria-label="다음 나라 보기"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          <div className="absolute bottom-3 right-6 flex gap-1.5 sm:right-8">
            {COUNTRY_SLIDES.map((item, index) => (
              <button
                key={item.name}
                type="button"
                onClick={() => goTo(index)}
                className={`h-2 rounded-full transition-all ${
                  index === current ? 'w-5 bg-white' : 'w-2 bg-white/40'
                }`}
                aria-label={`${item.name} 보기`}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted">
          <span>6+ 개국 그림책</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>한국어 / 영어</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>교사 관리 안전 환경</span>
        </div>
      </div>
    </section>
  );
}
