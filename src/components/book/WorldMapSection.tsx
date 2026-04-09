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

/* ── Pin coordinates (calibrated to world_map.png pixel data) ── */
const PIN_COORDS: Record<string, { x: number; y: number }> = {
  colombia: { x: 294, y: 330 },
  peru:     { x: 289, y: 371 },
  kenya:    { x: 592, y: 309 },
  tanzania: { x: 592, y: 338 },
  nepal:    { x: 736, y: 248 },
  cambodia: { x: 783, y: 271 },
};

/* ── Flight route order (west → east) ── */
const ROUTE_ORDER = ['peru', 'colombia', 'kenya', 'tanzania', 'nepal', 'cambodia'];

/* ── Map image dimensions (viewBox matched to image aspect ratio) ── */
const MAP_VIEWBOX = { w: 1000, h: 546 };

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
          viewBox={`0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`}
          className="w-full h-auto"
          style={{ maxHeight: 420 }}
        >
          {/* ── World map background image ── */}
          <image
            href="/images/world_map.png"
            x="0"
            y="0"
            width={MAP_VIEWBOX.w}
            height={MAP_VIEWBOX.h}
            opacity={0.2}
            preserveAspectRatio="xMidYMid slice"
          />

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
