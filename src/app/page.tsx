'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';

const features = [
  {
    icon: '📖',
    title: 'Story Read',
    description: '세계 각국의 그림책을 읽고 감정을 표현해요',
    color: 'bg-primary/10 text-primary',
  },
  {
    icon: '🔍',
    title: 'Hidden Stories',
    description: '책 속 숨겨진 이야기와 문화를 탐험해요',
    color: 'bg-secondary/10 text-secondary-dark',
  },
  {
    icon: '✏️',
    title: 'My Story',
    description: '나만의 이야기를 쓰고 그림책을 만들어요',
    color: 'bg-accent/10 text-accent-dark',
  },
];

const floatingBooks = [
  { emoji: '📕', x: '10%', y: '20%', delay: 0, duration: 4 },
  { emoji: '📗', x: '85%', y: '15%', delay: 1.2, duration: 5 },
  { emoji: '📘', x: '75%', y: '70%', delay: 0.5, duration: 4.5 },
  { emoji: '📙', x: '15%', y: '75%', delay: 1.8, duration: 3.8 },
  { emoji: '🌍', x: '90%', y: '45%', delay: 0.8, duration: 5.2 },
  { emoji: '🌏', x: '5%', y: '50%', delay: 2, duration: 4.2 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4">
        {/* Floating decorations */}
        {floatingBooks.map((item, i) => (
          <motion.div
            key={i}
            className="absolute text-3xl sm:text-4xl opacity-20 pointer-events-none select-none"
            style={{ left: item.x, top: item.y }}
            animate={{ y: [-12, 12, -12] }}
            transition={{
              duration: item.duration,
              repeat: Infinity,
              delay: item.delay,
              ease: 'easeInOut',
            }}
          >
            {item.emoji}
          </motion.div>
        ))}

        {/* Open book illustration - CSS animation */}
        <div className="relative mb-8 animate-fade-in-scale">
          <div className="flex items-end gap-0">
            {/* Left page */}
            <div
              className="w-24 h-32 sm:w-32 sm:h-40 bg-card rounded-l-lg border-2 border-r-0 border-primary/40 shadow-md"
              style={{ transform: 'perspective(400px) rotateY(15deg)', transformOrigin: 'right center' }}
            >
              <div className="p-3 space-y-1.5">
                <div className="h-1.5 bg-primary/20 rounded-full w-full" />
                <div className="h-1.5 bg-primary/15 rounded-full w-4/5" />
                <div className="h-1.5 bg-primary/20 rounded-full w-full" />
                <div className="h-1.5 bg-primary/15 rounded-full w-3/5" />
                <div className="h-1.5 bg-primary/20 rounded-full w-full" />
              </div>
            </div>
            {/* Spine */}
            <div className="w-1.5 h-32 sm:h-40 bg-gradient-to-r from-primary/50 to-primary/30 shadow-inner" />
            {/* Right page */}
            <div
              className="w-24 h-32 sm:w-32 sm:h-40 bg-card rounded-r-lg border-2 border-l-0 border-primary/40 shadow-md"
              style={{ transform: 'perspective(400px) rotateY(-15deg)', transformOrigin: 'left center' }}
            >
              <div className="p-3 space-y-1.5">
                <div className="h-1.5 bg-primary/20 rounded-full w-full" />
                <div className="h-1.5 bg-primary/15 rounded-full w-4/5" />
                <div className="h-1.5 bg-primary/20 rounded-full w-full" />
                <div className="h-1.5 bg-primary/15 rounded-full w-2/3" />
                <div className="h-1.5 bg-primary/20 rounded-full w-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Title - CSS animation (no Framer Motion dependency) */}
        <div
          className="text-center relative z-10 animate-fade-in-up"
          style={{ animationDelay: '0.2s', animationFillMode: 'both' }}
        >
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-heading text-primary mb-3">
            World Docent
          </h1>
          <p className="text-lg sm:text-xl text-foreground/70 mb-2">
            글로벌 독서 여행
          </p>
          <p className="text-sm text-muted max-w-md mx-auto mb-10">
            세계 각국의 이야기를 읽고, 캐릭터와 대화하고,<br />
            나만의 이야기를 쓰는 독서 교육 플랫폼
          </p>

          <Link
            href="/login"
            className="inline-block px-10 py-3.5 bg-primary text-white rounded-full font-heading text-lg hover:bg-primary-dark transition-colors shadow-lg hover:shadow-xl hover:-translate-y-0.5 transform transition-all"
          >
            독서 여행 시작하기
          </Link>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 text-muted text-sm flex flex-col items-center gap-2 animate-pulse">
          <span>아래로 스크롤</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-card/50">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-heading text-center text-foreground mb-12">
            세 가지 독서 활동
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow text-center animate-fade-in-up"
                style={{ animationDelay: `${index * 0.15}s`, animationFillMode: 'both' }}
              >
                <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center text-3xl mx-auto mb-4`}>
                  {feature.icon}
                </div>
                <h3 className="font-heading text-lg text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-xs text-muted">
          World Docent &copy; 2024. 글로벌 독서 교육 플랫폼
        </p>
      </footer>
    </div>
  );
}
