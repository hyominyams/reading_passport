'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

const HERO_VIDEO_PATH = '/Hero_video.mp4';
const HERO_TEXT_REVEAL_TIME = 6;
const HERO_VIDEO_FREEZE_OFFSET = 0.05;

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

    return () => {
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
      <div className="h-24 sm:h-32 bg-gradient-to-b from-[#08080d] to-background" />

      {/* ═══════════════════════════════════════════
          ABOUT — 디지털 독서 여권이란?
      ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-8 sm:px-12 md:px-20 lg:px-28 bg-background">
        <div className="max-w-5xl mx-auto mb-16">
          <p className="text-[11px] sm:text-xs tracking-[0.35em] uppercase text-muted font-heading font-medium mb-3">
            About the Platform
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground leading-tight">
            이야기를 읽고, 탐험하고,<br />
            <span className="text-muted">나만의 책을 만드세요</span>
          </h2>
        </div>

        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* 나라 선택 */}
          <div className="p-7 rounded-2xl bg-white border border-border hover:shadow-lg transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center mb-5">
              <svg className="w-5.5 h-5.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9 9 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
            </div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-amber-500 font-heading font-medium mb-2">Select</p>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">나라와 책을 선택</h3>
            <p className="text-sm text-muted leading-relaxed">
              콜롬비아, 탄자니아, 캄보디아 등 제3세계 나라의 그림책을 한국어 또는 영어로 골라 읽어요
            </p>
          </div>

          {/* 독서 활동 */}
          <div className="p-7 rounded-2xl bg-white border border-border hover:shadow-lg transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center mb-5">
              <svg className="w-5.5 h-5.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
            </div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-emerald-500 font-heading font-medium mb-2">Explore</p>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">4가지 활동으로 탐험</h3>
            <p className="text-sm text-muted leading-relaxed">
              그림책 읽기, 숨은 문화 탐험, AI 캐릭터와 대화, 나만의 이야기 창작까지 단계별로 진행해요
            </p>
          </div>

          {/* 여권 완성 */}
          <div className="p-7 rounded-2xl bg-white border border-border hover:shadow-lg transition-shadow">
            <div className="w-11 h-11 rounded-xl bg-sky-50 flex items-center justify-center mb-5">
              <svg className="w-5.5 h-5.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
              </svg>
            </div>
            <p className="text-[10px] tracking-[0.25em] uppercase text-sky-500 font-heading font-medium mb-2">Complete</p>
            <h3 className="text-lg font-heading font-semibold text-foreground mb-2">도장 모아 여권 완성</h3>
            <p className="text-sm text-muted leading-relaxed">
              활동마다 도장을 받고, 4개를 모으면 해당 나라의 여권 페이지가 완성돼요. 여러 나라를 정복해보세요!
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          ACTIVITIES — 4-step journey
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

        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
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
              title: 'Talk with Character',
              desc: '등장인물과 AI 대화를 통해 이야기를 깊이 이해합니다',
              iconBg: 'bg-sky-50',
              iconColor: 'text-sky-500',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              ),
            },
            {
              step: '04',
              title: 'My Story',
              desc: '나만의 이야기를 창작하고 그림책으로 완성합니다',
              iconBg: 'bg-violet-50',
              iconColor: 'text-violet-500',
              icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
              ),
            },
          ].map((item) => (
            <div
              key={item.title}
              className="group p-6 rounded-2xl bg-background border border-border hover:shadow-lg hover:border-border/80 transition-all"
            >
              <div className={`w-10 h-10 rounded-xl ${item.iconBg} flex items-center justify-center mb-4`}>
                <svg className={`w-5 h-5 ${item.iconColor}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {item.icon}
                </svg>
              </div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-muted/60 font-heading font-medium mb-1.5">{item.step}</p>
              <h3 className="text-base font-heading font-semibold text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          PASSPORT — Stamp system
      ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-8 sm:px-12 md:px-20 lg:px-28 bg-background">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center gap-12 md:gap-20">
          {/* Left — text */}
          <div className="flex-1">
            <p className="text-[11px] sm:text-xs tracking-[0.35em] uppercase text-muted font-heading font-medium mb-3">
              Passport System
            </p>
            <h2 className="text-2xl sm:text-3xl font-heading font-bold text-foreground leading-tight mb-4">
              도장을 모아<br />여권을 완성하세요
            </h2>
            <p className="text-sm text-muted leading-relaxed max-w-sm">
              각 활동을 완료하면 도장 하나를 받습니다. 네 개를 모두 모으면 해당 나라의 여권 페이지가 완성되고, 여러 나라를 정복하며 나만의 독서 여권을 채워나갈 수 있어요.
            </p>
          </div>

          {/* Right — passport page mockup */}
          <div className="flex-1 flex justify-center">
            <div className="w-full max-w-xs bg-white rounded-2xl border border-border shadow-lg overflow-hidden">
              {/* Passport page header */}
              <div className="px-6 pt-6 pb-4 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🇨🇴</span>
                  <div>
                    <p className="text-xs text-muted font-heading uppercase tracking-wider">Colombia</p>
                    <p className="text-base font-heading font-semibold text-foreground">콜롬비아</p>
                  </div>
                </div>
              </div>

              {/* Stamp grid */}
              <div className="p-6 grid grid-cols-2 gap-3">
                {[
                  { label: 'Story Read', color: 'bg-amber-500', filled: true },
                  { label: 'Hidden Stories', color: 'bg-emerald-500', filled: true },
                  { label: 'Character Chat', color: 'bg-sky-500', filled: true },
                  { label: 'My Story', color: 'bg-violet-500', filled: false },
                ].map((stamp) => (
                  <div
                    key={stamp.label}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-1.5 ${
                      stamp.filled
                        ? `${stamp.color} shadow-sm`
                        : 'border-2 border-dashed border-border'
                    }`}
                  >
                    {stamp.filled ? (
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                    )}
                    <span className={`text-[9px] font-heading font-medium tracking-wide ${
                      stamp.filled ? 'text-white/80' : 'text-muted/50'
                    }`}>
                      {stamp.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="px-6 pb-5">
                <div className="flex items-center justify-between text-[10px] text-muted mb-1.5">
                  <span>진행률</span>
                  <span className="font-heading font-medium">3 / 4</span>
                </div>
                <div className="h-1.5 bg-border/40 rounded-full overflow-hidden">
                  <div className="h-full w-3/4 bg-stamp-gold rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          GLOBAL — 글로벌 독서 여행
      ═══════════════════════════════════════════ */}
      <section className="relative py-20 sm:py-28 px-8 sm:px-12 md:px-20 lg:px-28 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-start gap-12 md:gap-20">
          <div className="flex-1">
            <p className="text-[11px] sm:text-xs tracking-[0.35em] uppercase text-muted font-heading font-medium mb-3">
              Global Reading
            </p>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-foreground leading-tight mb-5">
              세계와 연결되는<br />독서 경험
            </h2>
            <p className="text-sm text-muted leading-relaxed max-w-md mb-6">
              제3세계 그림책을 한국어와 영어로 읽고, AI 캐릭터와 대화하며 문화를 탐구합니다. 완성한 나만의 이야기는 글로벌 플랫폼에 공유되어 전 세계 친구들과 소통할 수 있습니다.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              <span>교사 관리 하에 안전한 AI 독서 환경을 제공합니다</span>
            </div>
          </div>

          <div className="flex-1 grid grid-cols-2 gap-4">
            {[
              { label: '대상 국가 그림책', value: '6+', icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3" />
              )},
              { label: '지원 언어', value: 'KO / EN', icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
              )},
              { label: 'AI 활동', value: '4가지', icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              )},
              { label: '역할', value: '학생 / 교사', icon: (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              )},
            ].map((stat) => (
              <div key={stat.label} className="p-5 rounded-xl bg-background border border-border">
                <svg className="w-4.5 h-4.5 text-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  {stat.icon}
                </svg>
                <p className="text-xl sm:text-2xl font-heading font-bold text-foreground mb-0.5">{stat.value}</p>
                <p className="text-xs text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════
          CTA — dark contrast
      ═══════════════════════════════════════════ */}
      <section className="relative py-24 sm:py-32 px-8 bg-foreground text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold text-white mb-4 leading-tight">
            이야기로 세계를 연결하세요
          </h2>
          <p className="text-sm text-white/50 mb-10">
            지금 바로 디지털 독서 여권을 시작하세요
          </p>
          <Link
            href="/login"
            className="group inline-flex items-center gap-3 px-10 py-3.5 bg-white text-foreground rounded-full text-sm font-heading font-semibold tracking-wide hover:bg-white/90 transition-all hover:-translate-y-0.5"
          >
            시작하기
            <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-8 bg-foreground text-center border-t border-white/[0.06]">
        <p className="text-xs text-white/30 tracking-wide">
          World Stories &copy; 2026 &middot; Digital Reading Passport
        </p>
      </footer>
    </div>
  );
}
