'use client';

import { useMemo } from 'react';
import { countries } from '@/lib/data/countries';

interface CountryProgressSummary {
  bookCount: number;
  startedBookCount: number;
  completedBookCount: number;
}

interface WorldMapSectionProps {
  countryProgress: Record<string, CountryProgressSummary>;
  onCountryClick: (countryId: string) => void;
  selectedCountry: string | null;
}

/* ── Pin coordinates (equirectangular projection, viewBox 0 0 1000 500) ── */
const PIN_COORDS: Record<string, { x: number; y: number }> = {
  colombia: { x: 294, y: 237 },
  peru:     { x: 286, y: 283 },
  tanzania: { x: 597, y: 268 },
  kenya:    { x: 605, y: 250 },
  cambodia: { x: 792, y: 215 },
  nepal:    { x: 734, y: 171 },
};

/* ── Flight route order (west → east) ── */
const ROUTE_ORDER = ['peru', 'colombia', 'kenya', 'tanzania', 'nepal', 'cambodia'];

/* ── Simplified continent paths (passport-watermark style) ── */
const CONTINENTS = [
  // North America
  'M 33 72 C 45 92,60 105,80 112 C 110 118,140 115,155 118 C 162 130,166 145,172 160 C 182 175,198 188,218 198 C 238 208,258 215,270 222 L 278 228 L 280 210 C 282 195,282 180,285 168 C 290 152,300 140,315 130 C 328 122,342 118,355 115 L 350 105 C 340 96,318 88,290 80 C 260 72,225 66,180 65 C 140 64,95 66,60 64 Z',
  // South America
  'M 280 232 C 298 228,330 234,360 248 C 385 262,400 280,400 305 C 398 330,380 355,355 375 C 335 390,315 400,305 405 C 298 395,292 375,288 350 C 284 325,282 298,280 275 Z',
  // Africa
  'M 486 162 C 510 156,540 158,568 164 C 586 172,600 188,612 210 C 624 232,636 240,630 252 C 622 262,610 272,600 290 C 592 312,578 335,562 350 C 548 360,535 358,525 345 C 515 330,506 308,500 285 C 492 260,480 235,470 215 C 458 200,455 188,465 175 C 472 168,480 164,486 162 Z',
  // Europe
  'M 465 155 C 460 140,465 120,475 105 C 485 90,498 78,512 70 C 526 64,542 68,550 80 C 556 92,555 108,548 122 C 540 135,528 146,515 152 C 500 158,480 160,468 158 Z',
  // Asia (main)
  'M 555 62 C 590 52,640 48,695 54 C 738 58,778 72,810 92 C 832 108,845 130,842 158 C 840 178,825 192,808 202 C 792 210,775 220,758 228 C 738 232,718 225,698 215 C 678 205,658 195,638 190 C 618 186,598 184,582 178 C 568 172,560 158,556 140 C 553 118,553 82,555 62 Z',
  // Indian subcontinent
  'M 685 208 C 695 222,708 240,712 258 C 714 268,706 272,696 264 C 686 254,680 238,678 222 C 676 214,680 208,685 208 Z',
  // Southeast Asian archipelago
  'M 798 232 C 808 228,822 232,830 240 C 835 248,830 255,820 252 C 810 250,800 244,798 238 Z',
  // Australia
  'M 822 312 C 845 304,872 308,886 324 C 895 336,892 354,878 364 C 864 372,842 370,828 358 C 816 346,812 330,818 316 Z',
  // Greenland
  'M 355 48 C 370 42,390 46,400 58 C 406 68,402 78,390 82 C 378 86,364 82,358 72 C 352 64,350 54,355 48 Z',
  // Japan
  'M 852 132 C 858 125,866 128,866 138 C 866 150,860 160,852 156 C 845 152,846 140,852 132 Z',
  // British Isles
  'M 468 96 C 473 90,480 90,482 96 C 484 104,480 112,474 112 C 468 110,465 104,468 96 Z',
];

function getStatusColors(progress: CountryProgressSummary | undefined) {
  if (!progress || progress.bookCount === 0)
    return { fill: '#9ca3af', stroke: '#6b7280', glow: 'rgba(156,163,175,0.3)' };
  if (progress.completedBookCount >= progress.bookCount)
    return { fill: '#f59e0b', stroke: '#d97706', glow: 'rgba(245,158,11,0.4)' };
  if (progress.startedBookCount > 0)
    return { fill: '#6366f1', stroke: '#4f46e5', glow: 'rgba(99,102,241,0.4)' };
  return { fill: '#9ca3af', stroke: '#6b7280', glow: 'rgba(156,163,175,0.3)' };
}

/** Quadratic Bézier arc between two pins – bows upward */
function arcBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  const mx = (a.x + b.x) / 2;
  const my = Math.min(a.y, b.y) - Math.abs(b.x - a.x) * 0.15;
  return `M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}`;
}

export default function WorldMapSection({
  countryProgress,
  onCountryClick,
  selectedCountry,
}: WorldMapSectionProps) {
  const routes = useMemo(() => {
    const paths: string[] = [];
    for (let i = 0; i < ROUTE_ORDER.length - 1; i++) {
      const from = PIN_COORDS[ROUTE_ORDER[i]];
      const to = PIN_COORDS[ROUTE_ORDER[i + 1]];
      if (from && to) paths.push(arcBetween(from, to));
    }
    return paths;
  }, []);

  const pins = useMemo(
    () =>
      countries
        .map((c) => ({
          ...c,
          coords: PIN_COORDS[c.id],
          colors: getStatusColors(countryProgress[c.id]),
          progress: countryProgress[c.id],
        }))
        .filter((c) => c.coords),
    [countryProgress],
  );

  return (
    <div className="mt-8 rounded-2xl border border-border bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border">
        <p className="text-xs tracking-[0.2em] uppercase text-muted font-heading font-medium">
          Reading Journey
        </p>
        <h2 className="text-lg font-heading font-semibold text-foreground">
          나의 독서 여행
        </h2>
      </div>

      {/* Map area */}
      <div className="px-2 sm:px-6 py-4 sm:py-6">
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-auto"
          style={{ maxHeight: 420 }}
        >
          {/* ── Continents (faint watermark) ── */}
          {CONTINENTS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="#94a3b8"
              fillOpacity={0.07}
              stroke="#94a3b8"
              strokeOpacity={0.14}
              strokeWidth={1}
            />
          ))}

          {/* ── Flight routes (dashed arcs) ── */}
          {routes.map((d, i) => (
            <path
              key={`r-${i}`}
              d={d}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth={1.5}
              strokeDasharray="8 5"
              strokeLinecap="round"
            />
          ))}

          {/* ── Tiny airplane on each route midpoint ── */}
          {routes.map((_, i) => {
            const from = PIN_COORDS[ROUTE_ORDER[i]];
            const to = PIN_COORDS[ROUTE_ORDER[i + 1]];
            if (!from || !to) return null;
            const mx = (from.x + to.x) / 2;
            const my =
              Math.min(from.y, to.y) - Math.abs(to.x - from.x) * 0.15;
            const angle =
              (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
            return (
              <g
                key={`plane-${i}`}
                transform={`translate(${mx},${my}) rotate(${angle})`}
              >
                <path
                  d="M -6 0 L 2 -3 L 6 0 L 2 3 Z"
                  fill="#94a3b8"
                  fillOpacity={0.5}
                />
              </g>
            );
          })}

          {/* ── Country pins ── */}
          {pins.map((c) => {
            const sel = selectedCountry === c.id;
            const { x, y } = c.coords;
            return (
              <g
                key={c.id}
                className="cursor-pointer"
                onClick={() => onCountryClick(c.id)}
              >
                {/* Invisible larger hit area */}
                <circle cx={x} cy={y} r={20} fill="transparent" />

                {/* Pulse ring (selected only) */}
                {sel && (
                  <circle cx={x} cy={y} r={14} fill={c.colors.glow} opacity={0.5}>
                    <animate
                      attributeName="r"
                      values="14;24;14"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      values="0.5;0.1;0.5"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}

                {/* Shadow */}
                <circle
                  cx={x}
                  cy={y + 2}
                  r={sel ? 10 : 8}
                  fill="black"
                  fillOpacity={0.12}
                />

                {/* Main pin circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={sel ? 10 : 8}
                  fill={c.colors.fill}
                  stroke="white"
                  strokeWidth={2.5}
                />

                {/* Inner highlight */}
                <circle cx={x} cy={y} r={3} fill="white" fillOpacity={0.85} />

                {/* Flag above pin */}
                <text
                  x={x}
                  y={y - 18}
                  textAnchor="middle"
                  fontSize="16"
                  className="pointer-events-none select-none"
                >
                  {c.flag}
                </text>

                {/* Country name below pin */}
                <text
                  x={x}
                  y={y + 26}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="600"
                  fill="#374151"
                  className="pointer-events-none select-none"
                  fontFamily="var(--font-heading), sans-serif"
                >
                  {c.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-6 text-xs text-muted">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-stamp-gold" />
            <span>완료</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-secondary" />
            <span>진행중</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400" />
            <span>미시작</span>
          </div>
        </div>
      </div>
    </div>
  );
}
