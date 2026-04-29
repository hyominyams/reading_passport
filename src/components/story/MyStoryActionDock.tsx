'use client';

import type { ReactNode } from 'react';

interface MyStoryActionDockProps {
  children: ReactNode;
  /** Optional left-side info (e.g., "3/5 페이지 작성 완료") shown alongside the actions. */
  info?: ReactNode;
}

/**
 * Mobile-only sticky CTA dock for My World pages. On md+ falls back to in-flow.
 * Mobile dock sits just above MobileBottomBar (h-14 + iOS safe-area).
 */
export default function MyStoryActionDock({ children, info }: MyStoryActionDockProps) {
  return (
    <>
      {/* Spacer so the last item isn't hidden behind the fixed dock on mobile */}
      <div className="h-24 md:hidden" aria-hidden="true" />

      <div
        className="fixed inset-x-0 z-30 border-t border-border/60 bg-white/95 px-4 py-3 backdrop-blur shadow-[0_-2px_12px_rgba(0,0,0,0.04)] md:static md:inset-auto md:mt-10 md:border-0 md:bg-transparent md:p-0 md:shadow-none md:backdrop-blur-none"
        style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between gap-3 md:justify-end">
          {info && (
            <div className="min-w-0 flex-1 text-xs leading-tight text-muted md:flex-initial md:text-sm">
              {info}
            </div>
          )}
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        </div>
      </div>
    </>
  );
}
