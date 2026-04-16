'use client';

import { motion } from 'framer-motion';

const PASSPORT_LEGEND = [
  { emoji: '📖', label: 'Story Read' },
  { emoji: '🔍', label: 'Hidden Stories' },
  { emoji: '🌍', label: 'Expanding World' },
  { emoji: '✏️', label: 'My World' },
];

const PASSPORT_STAMPS = [
  { flag: '🇨🇴', name: 'COLOMBIA', sub: '2026.03.12', color: '#dc2626', rotation: -8, top: '4%', left: '5%', shape: 'circle' as const },
  { flag: '🇹🇿', name: 'TANZANIA', sub: '2026.03.19', color: '#2563eb', rotation: 5, top: '8%', left: '52%', shape: 'circle' as const },
  { flag: '🇰🇭', name: 'CAMBODIA', sub: '2026.04.02', color: '#16a34a', rotation: -3, top: '32%', left: '10%', shape: 'rect' as const },
  { flag: '🇳🇵', name: 'NEPAL', sub: '2026.04.05', color: '#7c3aed', rotation: 12, top: '36%', left: '55%', shape: 'circle' as const },
  { flag: '🇷🇼', name: 'RWANDA', sub: '2026.04.08', color: '#ea580c', rotation: -6, top: '62%', left: '8%', shape: 'circle' as const },
  { flag: '🇰🇪', name: 'KENYA', sub: '2026.04.10', color: '#0891b2', rotation: 8, top: '66%', left: '50%', shape: 'rect' as const },
];

export default function HomePassportShowcase() {
  return (
    <section className="relative bg-background px-8 py-28 sm:px-12 sm:py-36 md:px-20 lg:px-28">
      <div className="mx-auto flex max-w-5xl flex-col gap-14 md:flex-row md:items-center md:gap-20">
        <div className="flex-1">
          <p className="mb-3 text-[11px] font-heading font-medium uppercase tracking-[0.35em] text-muted sm:text-xs">
            Passport System
          </p>
          <h2 className="mb-4 text-2xl font-heading font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
            도장을 모아
            <br />
            여권을 완성하세요
          </h2>
          <p className="mb-8 max-w-sm text-sm leading-relaxed text-muted">
            각 활동을 완료하면 도장 하나를 받습니다. 네 개를 모두 모으면 해당 나라의 여권 페이지가 완성되고, 여러 나라를 정복하며 나만의 독서 여권을 채워나갈 수 있어요.
          </p>
          <div className="space-y-2">
            {PASSPORT_LEGEND.map((item) => (
              <div key={item.label} className="flex items-center gap-2.5 text-xs text-muted">
                <span className="text-sm">{item.emoji}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-1 justify-center">
          <div className="w-full max-w-[340px] overflow-hidden rounded-2xl border border-border bg-white shadow-xl">
            <div className="border-b border-border/60 bg-foreground px-6 pb-4 pt-6 text-white">
              <p className="mb-1 text-[10px] font-heading font-medium uppercase tracking-[0.3em] text-white/40">
                Digital Reading Passport
              </p>
              <p className="text-lg font-heading font-bold tracking-tight">World Stories</p>
            </div>

            <div
              className="relative min-h-[420px] px-5 py-8"
              style={{
                backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.12) 0.8px, transparent 0.8px)',
                backgroundSize: '16px 16px',
              }}
            >
              <div
                className="pointer-events-none absolute inset-x-6 bottom-8 top-8"
                style={{
                  backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(148,163,184,0.1) 39px, rgba(148,163,184,0.1) 40px)',
                }}
              />

              {PASSPORT_STAMPS.map((stamp, index) => (
                <motion.div
                  key={stamp.name}
                  initial={{ scale: 4, opacity: 0, rotate: -20 }}
                  whileInView={{ scale: 1, opacity: 0.82, rotate: stamp.rotation }}
                  viewport={{ once: true, margin: '-80px' }}
                  transition={{
                    type: 'spring',
                    stiffness: 180,
                    damping: 14,
                    delay: index * 0.25,
                  }}
                  className="absolute"
                  style={{ top: stamp.top, left: stamp.left }}
                >
                  <div
                    className={`relative flex flex-col items-center justify-center ${
                      stamp.shape === 'circle'
                        ? 'h-[110px] w-[110px] rounded-full'
                        : 'h-[100px] w-[120px] rounded-lg'
                    }`}
                    style={{
                      border: `2.5px solid ${stamp.color}`,
                      color: stamp.color,
                    }}
                  >
                    <span className="mb-0.5 text-xl leading-none">{stamp.flag}</span>
                    <span className="text-[9px] font-heading font-bold leading-none tracking-[0.15em]">
                      {stamp.name}
                    </span>
                    <span className="mt-1 text-[7px] font-heading tracking-wider opacity-60">
                      {stamp.sub}
                    </span>
                    {stamp.shape === 'circle' && (
                      <div
                        className="pointer-events-none absolute inset-[5px] rounded-full"
                        style={{ border: `1px solid ${stamp.color}`, opacity: 0.3 }}
                      />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border/60 px-6 py-3">
              <span className="text-[10px] font-heading uppercase tracking-wider text-muted">6 Countries</span>
              <div className="flex items-center gap-1">
                {[...Array(6)].map((_, index) => (
                  <div key={index} className={`h-1.5 w-1.5 rounded-full ${index < 4 ? 'bg-stamp-gold' : 'bg-border'}`} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
