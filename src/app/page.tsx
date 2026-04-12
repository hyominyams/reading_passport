'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { OrbitingAvatarsCTA } from '@/components/ui/orbiting-avatars';
import { Mail, Gamepad2, GraduationCap, Briefcase } from 'lucide-react';

const HERO_VIDEO_PATH = '/Hero_video.mp4';
const HERO_TEXT_REVEAL_TIME = 6;
const HERO_VIDEO_FREEZE_OFFSET = 0.05;

const COUNTRY_SLIDES = [
  { name: '콜롬비아', flag: '🇨🇴', desc: '커피와 음악의 나라', image: 'https://images.unsplash.com/photo-1536308037887-165852797016?w=800&h=500&fit=crop' },
  { name: '탄자니아', flag: '🇹🇿', desc: '킬리만자로의 나라', image: 'https://images.unsplash.com/photo-1525535816528-974e4b19eb51?w=800&h=500&fit=crop' },
  { name: '캄보디아', flag: '🇰🇭', desc: '앙코르와트의 나라', image: 'https://images.unsplash.com/photo-1504639650150-bf773680d8c3?w=800&h=500&fit=crop' },
  { name: '네팔', flag: '🇳🇵', desc: '히말라야의 나라', image: 'https://images.unsplash.com/photo-1668966780359-78fe21493d9b?w=800&h=500&fit=crop' },
  { name: '페루', flag: '🇵🇪', desc: '잉카 문명의 나라', image: 'https://images.unsplash.com/photo-1497106636505-e4fd6e16d74c?w=800&h=500&fit=crop' },
  { name: '케냐', flag: '🇰🇪', desc: '사파리의 나라', image: 'https://images.unsplash.com/photo-1554490752-6a232eca5e60?w=800&h=500&fit=crop' },
];

function CountryCarouselSection() {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % COUNTRY_SLIDES.length);
    }, 5000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [startTimer]);

  const goTo = (idx: number) => {
    setCurrent(idx);
    startTimer();
  };

  const prev = () => goTo((current - 1 + COUNTRY_SLIDES.length) % COUNTRY_SLIDES.length);
  const next = () => goTo((current + 1) % COUNTRY_SLIDES.length);

  const slide = COUNTRY_SLIDES[current];

  return (
    <section className="relative py-20 sm:py-28 px-8 sm:px-12 md:px-20 lg:px-28 bg-white">
      <div className="max-w-5xl mx-auto">
        <div className="mb-12 text-center">
          <p className="text-[11px] sm:text-xs tracking-[0.35em] uppercase text-muted font-heading font-medium mb-3">
            Global Reading
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground leading-tight">
            세계와 연결되는<br />
            <span className="text-muted">독서 경험</span>
          </h2>
        </div>

        {/* Carousel */}
        <div className="relative rounded-2xl overflow-hidden aspect-[16/9] bg-gray-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={slide.image}
            src={slide.image}
            alt={slide.name}
            className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{slide.flag}</span>
              <h3 className="text-xl sm:text-2xl font-heading font-bold text-white">{slide.name}</h3>
            </div>
            <p className="text-sm text-white/70">{slide.desc}</p>
          </div>

          {/* Arrows */}
          <button
            onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </button>

          {/* Dots */}
          <div className="absolute bottom-3 right-6 sm:right-8 flex gap-1.5">
            {COUNTRY_SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === current ? 'bg-white w-5' : 'bg-white/40'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Sub info */}
        <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted">
          <span>6+ 개국 그림책</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span>한국어 / 영어</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span>교사 관리 안전 환경</span>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [showHeroText, setShowHeroText] = useState(false);

  const startHeroVideo = useCallback(() => {
    if (hasStarted) {
      return;
    }

    const video = videoRef.current;

    if (!video) {
      return;
    }

    setHasStarted(true);

    const playPromise = video.play();

    if (playPromise) {
      playPromise.catch(() => {
        setHasStarted(false);
      });
    }
  }, [hasStarted]);

  useEffect(() => {
    const { body, documentElement } = document;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    if (!hasEnded) {
      body.style.overflow = 'hidden';
      documentElement.style.overflow = 'hidden';
    } else {
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    }

    // Safety: unlock scroll after 15s (HMR, autoplay blocked, etc.)
    const safety = setTimeout(() => {
      if (!hasEnded) {
        setShowHeroText(true);
        setHasEnded(true);
      }
    }, 15000);

    return () => {
      clearTimeout(safety);
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [hasEnded]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      const heroRect = heroSectionRef.current?.getBoundingClientRect();
      const heroIsInView = heroRect
        ? heroRect.top <= 1 && heroRect.bottom > window.innerHeight * 0.6
        : true;

      if (!heroIsInView) {
        return;
      }

      if (!hasEnded) {
        event.preventDefault();
      }

      if (!hasStarted && event.deltaY > 0) {
        startHeroVideo();
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [hasEnded, hasStarted, startHeroVideo]);

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current;

    if (!video || showHeroText) {
      return;
    }

    if (video.currentTime >= HERO_TEXT_REVEAL_TIME) {
      setShowHeroText(true);
    }
  }, [showHeroText]);

  const skipVideo = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
      const safeDuration = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 8;
      video.currentTime = Math.max(safeDuration - HERO_VIDEO_FREEZE_OFFSET, 0);
    }
    setHasStarted(true);
    setShowHeroText(true);
    setHasEnded(true);
    setTimeout(() => {
      document.getElementById('after-hero')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const handleVideoEnded = useCallback(() => {
    const video = videoRef.current;

    if (video) {
      const safeDuration = Number.isFinite(video.duration) && video.duration > 0
        ? video.duration
        : 8;

      video.pause();
      video.currentTime = Math.max(safeDuration - HERO_VIDEO_FREEZE_OFFSET, 0);
    }

    setShowHeroText(true);
    setHasEnded(true);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden">
      {/* ═══════════════════════════════════════════
          HERO — full-wide, dark space video bg
      ═══════════════════════════════════════════ */}
      <section
        ref={heroSectionRef}
        className="relative w-full h-screen overflow-hidden bg-white"
      >
        {/* Video background */}
        <video
          ref={videoRef}
          muted
          preload="auto"
          playsInline
          onEnded={handleVideoEnded}
          onTimeUpdate={handleVideoTimeUpdate}
          className="absolute inset-0 h-full w-full object-cover"
        >
          <source src={HERO_VIDEO_PATH} type="video/mp4" />
        </video>

        {/* Skip video button — top right */}
        {!hasEnded && (
          <button
            type="button"
            onClick={skipVideo}
            className="absolute top-6 right-6 z-30 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-[11px] font-medium tracking-wide text-white/70 backdrop-blur-sm transition-all hover:bg-black/50 hover:text-white sm:top-8 sm:right-8 sm:text-xs"
          >
            영상 건너뛰기
          </button>
        )}

        {/* Gradient overlay — darker left for text, transparent right for video */}
        <div
          className={`absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent transition-opacity duration-700 ${
            hasStarted ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div
          className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 transition-opacity duration-700 ${
            hasStarted ? 'opacity-100' : 'opacity-0'
          }`}
        />

        {/* Intro hold screen */}
        <div
          className={`absolute inset-0 z-20 flex items-end justify-center bg-white px-6 pb-8 transition-opacity duration-700 sm:pb-10 ${
            hasStarted ? 'pointer-events-none opacity-0' : 'opacity-100'
          }`}
        >
          <button
            type="button"
            onClick={startHeroVideo}
            className="inline-flex items-center gap-3 rounded-full border border-black/10 bg-black/[0.02] px-4 py-2 text-[10px] font-medium uppercase tracking-[0.28em] text-black/55 transition hover:bg-black/[0.04] sm:text-[11px]"
            aria-label="휠을 내리거나 탭해서 히어로 영상을 시작하세요"
          >
            <span className="flex h-8 w-5 items-start justify-center rounded-full border border-black/15 p-1">
              <span className="block h-2 w-1 rounded-full bg-black/50 animate-bounce" />
            </span>
            휠을 내리거나 탭해 시작
          </button>
        </div>

        {/* Hero content — upper-left */}
        <div className="relative z-10 flex h-full flex-col justify-start px-8 pt-[16vh] sm:px-12 sm:pt-[20vh] md:px-20 lg:px-28">
          {showHeroText && (
            <div className="max-w-2xl">
              {/* Eyebrow */}
              <p
                className="mb-6 text-[11px] font-heading font-medium uppercase tracking-[0.35em] text-white/50 animate-fade-in-up sm:text-xs"
                style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
              >
                digital reading passport
              </p>

              {/* Main title */}
              <h1
                className="mb-6 font-heading font-bold leading-[1.1] text-white animate-fade-in-up"
                style={{ animationDelay: '0.4s', animationFillMode: 'both' }}
              >
                <span className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
                  World
                </span>
                <span className="mt-1 block text-5xl sm:text-6xl md:text-7xl lg:text-8xl">
                  Stories
                </span>
              </h1>

              {/* Thin divider */}
              <div
                className="mb-6 h-px w-12 bg-white/30 animate-fade-in-up"
                style={{ animationDelay: '0.55s', animationFillMode: 'both' }}
              />

              {/* Subtitle */}
              <p
                className="mb-10 max-w-md text-sm leading-relaxed text-white/60 font-light animate-fade-in-up sm:text-base"
                style={{ animationDelay: '0.6s', animationFillMode: 'both' }}
              >
                세계 각국의 이야기를 읽고, 캐릭터와 대화하며<br />
                나만의 이야기를 써내려가는 독서교육 플랫폼
              </p>

              {/* CTA */}
              <div
                className="animate-fade-in-up"
                style={{ animationDelay: '0.8s', animationFillMode: 'both' }}
              >
                <Link
                  href="/login"
                  className="group inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-8 py-3 text-sm font-medium tracking-wide text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/20"
                >
                  여행 시작하기
                  <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Scroll indicator */}
        {hasEnded && (
          <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 animate-pulse flex-col items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40">
            <span>Scroll</span>
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        )}
      </section>

      {/* ═══════════════════════════════════════════
          DARK → LIGHT transition
      ═══════════════════════════════════════════ */}
      <div id="after-hero" className="h-24 sm:h-32 bg-gradient-to-b from-[#08080d] to-white" />

      {/* ═══════════════════════════════════════════
          CAROUSEL — 세계 여러 나라 (비주얼 먼저)
      ═══════════════════════════════════════════ */}
      <CountryCarouselSection />

      {/* ═══════════════════════════════════════════
          ACTIVITIES — 4-step journey (다크 배경으로 차별화)
      ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-8 sm:px-12 md:px-20 lg:px-28 bg-white">
        <div className="max-w-5xl mx-auto mb-16">
          <p className="text-[11px] sm:text-xs tracking-[0.35em] uppercase text-muted font-heading font-medium mb-3">
            Activities
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground leading-tight">
            네 가지 독서 활동
          </h2>
          <p className="text-sm text-muted mt-3 max-w-lg">
            책 한 권마다 네 가지 활동을 완료하고 도장을 모아 나만의 독서 여권을 완성하세요
          </p>
        </div>

        {/* Desktop: horizontal timeline */}
        <div className="max-w-5xl mx-auto hidden md:block">
          {/* Timeline track */}
          <div className="relative">
            {/* Connection line */}
            <div className="absolute top-6 left-[calc(12.5%+20px)] right-[calc(12.5%+20px)] h-px bg-border" />

            <div className="grid grid-cols-4 gap-6">
              {[
                {
                  step: '01',
                  title: 'Story Read',
                  desc: '그림책을 읽고 감정 스티커와 한줄 감상을 남깁니다',
                  iconBg: 'bg-amber-50',
                  iconColor: 'text-amber-500',
                  dotColor: 'bg-amber-400',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  ),
                },
                {
                  step: '02',
                  title: 'Hidden Stories',
                  desc: '영상, 사진, 문서 등 교사가 준비한 문화 콘텐츠를 탐험합니다',
                  iconBg: 'bg-emerald-50',
                  iconColor: 'text-emerald-500',
                  dotColor: 'bg-emerald-400',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
                  ),
                },
                {
                  step: '03',
                  title: 'Expanding World',
                  desc: '책에 대한 질문을 만들며 세계를 넓히고 생각을 깊이 합니다',
                  iconBg: 'bg-sky-50',
                  iconColor: 'text-sky-500',
                  dotColor: 'bg-sky-400',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  ),
                },
                {
                  step: '04',
                  title: 'My World',
                  desc: '나만의 이야기를 창작하고 그림책으로 완성합니다',
                  iconBg: 'bg-violet-50',
                  iconColor: 'text-violet-500',
                  dotColor: 'bg-violet-400',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                  ),
                },
              ].map((item) => (
                <div key={item.title} className="flex flex-col items-center text-center">
                  {/* Icon node */}
                  <div className={`relative z-10 w-12 h-12 rounded-2xl ${item.iconBg} flex items-center justify-center shadow-sm`}>
                    <svg className={`w-5 h-5 ${item.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      {item.icon}
                    </svg>
                  </div>
                  {/* Step & title */}
                  <p className="mt-5 text-[10px] tracking-[0.2em] uppercase text-muted font-heading font-medium">{item.step}</p>
                  <h3 className="mt-1 text-sm font-heading font-semibold text-foreground">{item.title}</h3>
                  {/* Description */}
                  <p className="mt-2 text-xs text-muted leading-relaxed max-w-[180px]">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile: vertical timeline */}
        <div className="max-w-sm mx-auto md:hidden">
          <div className="relative pl-10">
            {/* Vertical line */}
            <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" />

            <div className="space-y-8">
              {[
                {
                  step: '01',
                  title: 'Story Read',
                  desc: '그림책을 읽고 감정 스티커와 한줄 감상을 남깁니다',
                  iconBg: 'bg-amber-50',
                  iconColor: 'text-amber-500',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  ),
                },
                {
                  step: '02',
                  title: 'Hidden Stories',
                  desc: '영상, 사진, 문서 등 교사가 준비한 문화 콘텐츠를 탐험합니다',
                  iconBg: 'bg-emerald-50',
                  iconColor: 'text-emerald-500',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5m.75-9l3-3 2.148 2.148A12.061 12.061 0 0116.5 7.605" />
                  ),
                },
                {
                  step: '03',
                  title: 'Expanding World',
                  desc: '책에 대한 질문을 만들며 세계를 넓히고 생각을 깊이 합니다',
                  iconBg: 'bg-sky-50',
                  iconColor: 'text-sky-500',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  ),
                },
                {
                  step: '04',
                  title: 'My World',
                  desc: '나만의 이야기를 창작하고 그림책으로 완성합니다',
                  iconBg: 'bg-violet-50',
                  iconColor: 'text-violet-500',
                  icon: (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                  ),
                },
              ].map((item) => (
                <div key={item.title} className="relative flex items-start gap-4">
                  {/* Icon node on the line */}
                  <div className={`absolute -left-10 w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center shadow-sm`}>
                    <svg className={`w-4 h-4 ${item.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      {item.icon}
                    </svg>
                  </div>
                  {/* Text */}
                  <div>
                    <p className="text-[10px] tracking-[0.2em] uppercase text-muted font-heading font-medium">{item.step}</p>
                    <h3 className="text-sm font-heading font-semibold text-foreground mt-0.5">{item.title}</h3>
                    <p className="text-xs text-muted leading-relaxed mt-1">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          PASSPORT — Stamp system
      ═══════════════════════════════════════════ */}
      <section className="relative py-28 sm:py-36 px-8 sm:px-12 md:px-20 lg:px-28 bg-background">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center gap-14 md:gap-20">
          {/* Left — text */}
          <div className="flex-1">
            <p className="text-[11px] sm:text-xs tracking-[0.35em] uppercase text-muted font-heading font-medium mb-3">
              Passport System
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground leading-tight mb-4">
              도장을 모아<br />여권을 완성하세요
            </h2>
            <p className="text-sm text-muted leading-relaxed max-w-sm mb-8">
              각 활동을 완료하면 도장 하나를 받습니다. 네 개를 모두 모으면 해당 나라의 여권 페이지가 완성되고, 여러 나라를 정복하며 나만의 독서 여권을 채워나갈 수 있어요.
            </p>
            {/* Legend */}
            <div className="space-y-2">
              {[
                { emoji: '📖', label: 'Story Read' },
                { emoji: '🔍', label: 'Hidden Stories' },
                { emoji: '🌍', label: 'Expanding World' },
                { emoji: '✏️', label: 'My World' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-2.5 text-xs text-muted">
                  <span className="text-sm">{item.emoji}</span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right — passport page mockup */}
          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-[340px] bg-white rounded-2xl border border-border shadow-xl overflow-hidden">
              {/* Passport header */}
              <div className="px-6 pt-6 pb-4 border-b border-border/60 bg-foreground text-white">
                <p className="text-[10px] tracking-[0.3em] uppercase font-heading font-medium text-white/40 mb-1">
                  Digital Reading Passport
                </p>
                <p className="text-lg font-heading font-bold tracking-tight">World Stories</p>
              </div>

              {/* Stamp area — passport page body */}
              <div className="relative px-5 py-8 min-h-[420px]"
                style={{
                  backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.12) 0.8px, transparent 0.8px)',
                  backgroundSize: '16px 16px',
                }}
              >
                {/* Faint page lines */}
                <div className="absolute inset-x-6 top-8 bottom-8 pointer-events-none"
                  style={{
                    backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(148,163,184,0.1) 39px, rgba(148,163,184,0.1) 40px)',
                  }}
                />

                {/* Stamps — scattered like a real passport */}
                {[
                  { flag: '🇨🇴', name: 'COLOMBIA', sub: '2026.03.12', color: '#dc2626', rotation: -8, top: '4%', left: '5%', shape: 'circle' as const },
                  { flag: '🇹🇿', name: 'TANZANIA', sub: '2026.03.19', color: '#2563eb', rotation: 5, top: '8%', left: '52%', shape: 'circle' as const },
                  { flag: '🇰🇭', name: 'CAMBODIA', sub: '2026.04.02', color: '#16a34a', rotation: -3, top: '32%', left: '10%', shape: 'rect' as const },
                  { flag: '🇳🇵', name: 'NEPAL', sub: '2026.04.05', color: '#7c3aed', rotation: 12, top: '36%', left: '55%', shape: 'circle' as const },
                  { flag: '🇵🇪', name: 'PERU', sub: '2026.04.08', color: '#ea580c', rotation: -6, top: '62%', left: '8%', shape: 'circle' as const },
                  { flag: '🇰🇪', name: 'KENYA', sub: '2026.04.10', color: '#0891b2', rotation: 8, top: '66%', left: '50%', shape: 'rect' as const },
                ].map((stamp, i) => (
                  <motion.div
                    key={stamp.name}
                    initial={{ scale: 4, opacity: 0, rotate: -20 }}
                    whileInView={{ scale: 1, opacity: 0.82, rotate: stamp.rotation }}
                    viewport={{ once: true, margin: '-80px' }}
                    transition={{
                      type: 'spring',
                      stiffness: 180,
                      damping: 14,
                      delay: i * 0.25,
                    }}
                    className="absolute"
                    style={{ top: stamp.top, left: stamp.left }}
                  >
                    <div
                      className={`flex flex-col items-center justify-center ${
                        stamp.shape === 'circle'
                          ? 'w-[110px] h-[110px] rounded-full'
                          : 'w-[120px] h-[100px] rounded-lg'
                      }`}
                      style={{
                        border: `2.5px solid ${stamp.color}`,
                        color: stamp.color,
                      }}
                    >
                      <span className="text-xl leading-none mb-0.5">{stamp.flag}</span>
                      <span className="text-[9px] font-heading font-bold tracking-[0.15em] leading-none">
                        {stamp.name}
                      </span>
                      <span className="text-[7px] font-heading mt-1 opacity-60 tracking-wider">
                        {stamp.sub}
                      </span>
                      {/* Inner ring for circle stamps */}
                      {stamp.shape === 'circle' && (
                        <div
                          className="absolute inset-[5px] rounded-full pointer-events-none"
                          style={{ border: `1px solid ${stamp.color}`, opacity: 0.3 }}
                        />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Passport footer */}
              <div className="px-6 py-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-[10px] text-muted font-heading tracking-wider uppercase">6 Countries</span>
                <div className="flex items-center gap-1">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < 4 ? 'bg-stamp-gold' : 'bg-border'}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA — Orbiting Avatars
      ═══════════════════════════════════════════ */}
      <OrbitingAvatarsCTA
        className="!h-[80vh] !rounded-none bg-foreground"
        title={
          <span className="font-heading text-white">이야기로 세계를 연결하세요</span>
        }
        description={
          <span className="text-white/50">
            지금 바로 디지털 독서 여권을 시작하세요
          </span>
        }
        buttonText="시작하기"
        buttonProps={{
          className: 'bg-white text-foreground hover:bg-white/90 rounded-full px-10 py-3 text-sm font-heading font-semibold tracking-wide',
          onClick: () => window.location.href = '/login',
        }}
        avatars={[
          { src: 'https://images.unsplash.com/photo-1536308037887-165852797016?w=400&h=400&fit=crop', alt: '콜롬비아' },
          { src: 'https://images.unsplash.com/photo-1525535816528-974e4b19eb51?w=400&h=400&fit=crop', alt: '탄자니아' },
          { src: 'https://images.unsplash.com/photo-1504639650150-bf773680d8c3?w=400&h=400&fit=crop', alt: '캄보디아' },
          { src: 'https://images.unsplash.com/photo-1668966780359-78fe21493d9b?w=400&h=400&fit=crop', alt: '네팔' },
          { src: 'https://images.unsplash.com/photo-1497106636505-e4fd6e16d74c?w=400&h=400&fit=crop', alt: '페루' },
          { src: 'https://images.unsplash.com/photo-1554490752-6a232eca5e60?w=400&h=400&fit=crop', alt: '케냐' },
        ]}
        orbitRadius={18}
        orbitDuration={50}
      />

      {/* Footer — white background */}
      <footer className="py-16 sm:py-20 px-8 sm:px-12 md:px-20 lg:px-28 bg-white border-t border-black/[0.06]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-start gap-12 sm:gap-0">
          {/* Brand — fixed width left */}
          <div className="sm:w-[220px] shrink-0">
            <p className="text-base font-heading font-bold text-foreground tracking-tight mb-3">
              World Stories
            </p>
            <p className="text-xs text-black/35">
              &copy; 2026 Park Junhyo
            </p>
          </div>

          {/* Link columns — evenly distributed */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-6">
            {/* Services */}
            <div>
              <p className="text-sm font-heading font-medium text-black/40 mb-4">Services</p>
              <ul className="space-y-3">
                <li>
                  <a href="https://for-teacher-ai.vercel.app/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
                    <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                    For Teacher AI
                  </a>
                </li>
                <li>
                  <a href="https://class-game-dun.vercel.app/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
                    <Gamepad2 className="w-3.5 h-3.5 shrink-0" />
                    Sinwol Quest
                  </a>
                </li>
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-sm font-heading font-medium text-black/40 mb-4">Contact</p>
              <ul className="space-y-3">
                <li>
                  <a href="mailto:jhjhpark0800@gmail.com" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    Email
                  </a>
                </li>
                <li>
                  <a href="https://www.linkedin.com/in/junhyo-park-b96996394" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a href="https://www.instagram.com/odnaw.t/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    Instagram
                  </a>
                </li>
              </ul>
            </div>

            {/* Developer */}
            <div>
              <p className="text-sm font-heading font-medium text-black/40 mb-4">Developer</p>
              <ul className="space-y-3">
                <li>
                  <a href="https://homepage-omega-three.vercel.app/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-foreground/70 hover:text-foreground transition-colors">
                    <Briefcase className="w-3.5 h-3.5 shrink-0" />
                    Portfolio
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
