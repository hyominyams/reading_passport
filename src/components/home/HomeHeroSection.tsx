'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

const HERO_VIDEO_PATH = '/Hero_video.mp4';
const HERO_TEXT_REVEAL_TIME = 6;
const HERO_VIDEO_FREEZE_OFFSET = 0.05;

export default function HomeHeroSection() {
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [hasEnded, setHasEnded] = useState(false);
  const [showHeroText, setShowHeroText] = useState(false);

  const freezeVideoNearEnd = useCallback(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const safeDuration = Number.isFinite(video.duration) && video.duration > 0
      ? video.duration
      : 8;

    video.pause();
    video.currentTime = Math.max(safeDuration - HERO_VIDEO_FREEZE_OFFSET, 0);
  }, []);

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

    const safety = window.setTimeout(() => {
      if (!hasEnded) {
        setShowHeroText(true);
        setHasEnded(true);
      }
    }, 15000);

    return () => {
      window.clearTimeout(safety);
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
    freezeVideoNearEnd();
    setHasStarted(true);
    setShowHeroText(true);
    setHasEnded(true);

    window.setTimeout(() => {
      document.getElementById('after-hero')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [freezeVideoNearEnd]);

  const handleVideoEnded = useCallback(() => {
    freezeVideoNearEnd();
    setShowHeroText(true);
    setHasEnded(true);
  }, [freezeVideoNearEnd]);

  return (
    <section
      ref={heroSectionRef}
      className="relative h-screen w-full overflow-hidden bg-white"
    >
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

      {!hasEnded && (
        <button
          type="button"
          onClick={skipVideo}
          className="absolute right-6 top-6 z-30 rounded-full border border-white/20 bg-black/30 px-4 py-2 text-[11px] font-medium tracking-wide text-white/70 backdrop-blur-sm transition-all hover:bg-black/50 hover:text-white sm:right-8 sm:top-8 sm:text-xs"
        >
          영상 건너뛰기
        </button>
      )}

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
            <span className="block h-2 w-1 animate-bounce rounded-full bg-black/50" />
          </span>
          휠을 내리거나 탭해 시작
        </button>
      </div>

      <div className="relative z-10 flex h-full flex-col justify-start px-8 pt-[16vh] sm:px-12 sm:pt-[20vh] md:px-20 lg:px-28">
        {showHeroText && (
          <div className="max-w-2xl">
            <p
              className="mb-6 text-[11px] font-heading font-medium uppercase tracking-[0.35em] text-white/50 animate-fade-in-up sm:text-xs"
              style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
            >
              digital reading passport
            </p>

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

            <div
              className="mb-6 h-px w-12 bg-white/30 animate-fade-in-up"
              style={{ animationDelay: '0.55s', animationFillMode: 'both' }}
            />

            <p
              className="mb-10 max-w-md text-sm font-light leading-relaxed text-white/60 animate-fade-in-up sm:text-base"
              style={{ animationDelay: '0.6s', animationFillMode: 'both' }}
            >
              세계 각국의 이야기를 읽고, 캐릭터와 대화하며
              <br />
              나만의 이야기를 써내려가는 독서교육 플랫폼
            </p>

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

      {hasEnded && (
        <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 animate-pulse flex-col items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/40">
          <span>Scroll</span>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      )}
    </section>
  );
}
