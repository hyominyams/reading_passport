'use client';

import { useMemo, useState } from 'react';
import { DETAIL_STEP_META } from '@/lib/mystory-steps';

interface MyStoryStepSidebarProps {
  currentStep: number;
  busy?: boolean;
  onStepSelect: (step: number) => void | Promise<void>;
}

export default function MyStoryStepSidebar({
  currentStep,
  busy = false,
  onStepSelect,
}: MyStoryStepSidebarProps) {
  const [open, setOpen] = useState(false);

  const currentIndex = useMemo(
    () => DETAIL_STEP_META.findIndex((item) => item.step === currentStep),
    [currentStep]
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed right-4 top-24 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-white/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur"
      >
        <span>{open ? '✕' : '☰'}</span>
        <span>세부 단계</span>
      </button>

      <aside
        className={`fixed right-4 top-36 z-30 w-72 max-w-[calc(100vw-2rem)] rounded-3xl border border-border bg-white/95 p-4 shadow-2xl backdrop-blur transition-all duration-200 ${
          open ? 'translate-x-0 opacity-100' : 'pointer-events-none translate-x-6 opacity-0'
        }`}
      >
        <div className="mb-3">
          <p className="text-sm font-bold text-foreground">내 이야기 쓰기 단계</p>
          <p className="mt-1 text-xs text-muted">
            이전 단계와 다음 단계로 이동할 수 있어요. 이동 전에 현재 내용은 저장됩니다.
          </p>
        </div>

        <div className="space-y-2">
          {DETAIL_STEP_META.map((item, index) => {
            const isCurrent = item.step === currentStep;
            const canOpen = !busy && index <= currentIndex + 1;

            return (
              <button
                key={item.step}
                type="button"
                onClick={() => {
                  if (!canOpen || isCurrent) return;
                  void onStepSelect(item.step);
                }}
                disabled={!canOpen || isCurrent}
                className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                  isCurrent
                    ? 'bg-foreground text-white'
                    : canOpen
                      ? 'bg-gray-50 text-foreground hover:bg-gray-100'
                      : 'bg-gray-50/60 text-gray-400'
                }`}
              >
                <span
                  className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isCurrent ? 'bg-white/20 text-white' : 'bg-white text-foreground'
                  }`}
                >
                  {index + 1}
                </span>
                <span className="flex-1 text-sm font-medium">{item.label}</span>
                {isCurrent && <span className="text-xs text-white/80">현재</span>}
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
