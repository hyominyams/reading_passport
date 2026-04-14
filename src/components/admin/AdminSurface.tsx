'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AdminSectionTone } from './admin-config';

export function AdminSectionHero({
  tone,
  icon: Icon,
  eyebrow,
  title,
  description,
  requirements,
  aside,
}: {
  tone: AdminSectionTone;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  requirements: string[];
  aside?: ReactNode;
}) {
  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[32px] border bg-gradient-to-br p-6 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.25)]',
        tone.border,
        tone.panel,
      )}
    >
      <div className="absolute inset-y-0 right-0 hidden w-1/3 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.72)_0%,rgba(255,255,255,0)_72%)] md:block" />

      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)] lg:items-end">
        <div>
          <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.16em] uppercase', tone.badge)}>
            <Icon className="h-3.5 w-3.5" />
            <span>{eyebrow}</span>
          </div>
          <h2 className="mt-4 text-2xl font-heading font-semibold text-slate-950 sm:text-[2rem]">
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            {description}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {requirements.map((item) => (
              <div
                key={item}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
                  tone.badge,
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {aside ? <div className="relative">{aside}</div> : null}
      </div>
    </section>
  );
}

export function AdminMetricCard({
  label,
  value,
  caption,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  caption?: string;
  icon: LucideIcon;
  tone: AdminSectionTone;
}) {
  return (
    <article className={cn('rounded-[24px] border bg-white/88 p-4 backdrop-blur-sm', tone.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-3 text-3xl font-heading font-semibold text-slate-950">
            {value}
          </p>
        </div>
        <div className={cn('inline-flex h-10 w-10 items-center justify-center rounded-2xl text-white shadow-sm', tone.iconWrap)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {caption ? (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          {caption}
        </p>
      ) : null}
    </article>
  );
}

export function AdminChecklistCard({
  title,
  items,
  activeSection,
}: {
  title: string;
  items: Array<{
    id: string;
    title: string;
    description: string;
    sections: string[];
  }>;
  activeSection?: string;
}) {
  const completed = items.length;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/88 p-5 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.3)] backdrop-blur-sm">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
            {title}
          </p>
          <p className="mt-2 text-2xl font-heading font-semibold text-slate-950">
            {completed}/{items.length}
          </p>
        </div>
        <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
          Admin Ready
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {items.map((item) => {
          const isActive = !!activeSection && item.sections.includes(activeSection);
          return (
            <div
              key={item.id}
              className={cn(
                'rounded-2xl border px-4 py-3 transition-colors',
                isActive
                  ? 'border-slate-900 bg-slate-950 text-white'
                  : 'border-slate-200 bg-slate-50/90 text-slate-800',
              )}
            >
              <div className="flex items-start gap-3">
                <CheckCircle2 className={cn('mt-0.5 h-4 w-4 shrink-0', isActive ? 'text-emerald-300' : 'text-emerald-600')} />
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className={cn('mt-1 text-xs leading-5', isActive ? 'text-white/80' : 'text-slate-500')}>
                    {item.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
