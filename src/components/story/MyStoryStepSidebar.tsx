'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DETAIL_STEP_META, DETAIL_STEP_TOTAL, getDetailStepProgressLabel } from '@/lib/mystory-steps';
import StoryPurposeCoach from '@/components/story/StoryPurposeCoach';

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
  const searchParams = useSearchParams();
  const storyId = searchParams.get('storyId');

  const currentIndex = useMemo(
    () => DETAIL_STEP_META.findIndex((item) => item.step === currentStep),
    [currentStep]
  );
  const showPurposeCoach = currentStep >= 3 && Boolean(storyId);

  return (
    <>
      {showPurposeCoach && (
        <StoryPurposeCoach storyId={storyId} autoOpen={currentStep === 3} />
      )}

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed top-[7.75rem] right-3 z-40 inline-flex min-h-11 max-w-[calc(100vw-1.5rem)] items-center gap-2 rounded-full border border-border bg-white/95 px-4 py-2 text-sm font-medium text-foreground shadow-lg backdrop-blur lg:top-auto lg:right-4 lg:bottom-4 xl:right-6 xl:bottom-6"
      >
        <span>{open ? '✕' : '☰'}</span>
        <span>{getDetailStepProgressLabel(currentStep)}</span>
      </button>

      <aside
        className={`fixed top-[10.75rem] left-3 right-3 z-40 max-h-[calc(100vh-13rem)] overflow-y-auto rounded-3xl border border-border bg-white/95 p-4 shadow-2xl backdrop-blur transition-all duration-200 lg:top-auto lg:bottom-20 lg:left-auto lg:right-4 lg:w-72 lg:max-w-[calc(100vw-2rem)] lg:max-h-[calc(100vh-6rem)] xl:right-6 ${
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0'
        }`}
      >
        <div className="mb-3">
          <p className="text-sm font-bold text-foreground">My World 단계</p>
          <p className="mt-1 text-xs text-muted">
            지금까지 만든 내용을 이어서 완성해요.
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
                className={`flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
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
                <span className="flex-1">
                  <span className="block text-xs opacity-70">
                    {index + 1}/{DETAIL_STEP_TOTAL}
                  </span>
                  <span className="block text-sm font-medium">{item.label}</span>
                </span>
                {isCurrent && <span className="text-xs text-white/80">현재</span>}
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
}
