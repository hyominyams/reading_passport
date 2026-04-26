'use client';

import { DETAIL_STEP_META } from '@/lib/mystory-steps';

const STEP_LABELS: Record<number, string> = {
  1: '채팅',
  3: '바꿔쓰기',
  4: '장면',
  5: '주인공',
  6: '표지',
  7: '제작',
  8: '완성',
};

interface StepProgressProps {
  currentStep: number;
}

export default function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <div className="flex items-center justify-between">
        {DETAIL_STEP_META.map((step, index) => {
          const isCompleted = currentStep > step.step;
          const isCurrent = currentStep === step.step;
          const displayNumber = index + 1;

          return (
            <div key={step.step} className="flex items-center flex-1 last:flex-none">
              {/* Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isCompleted
                      ? 'bg-indigo-600 text-white'
                      : isCurrent
                        ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-400'
                        : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {isCompleted ? '✓' : displayNumber}
                </div>
                <span
                  className={`text-[10px] mt-1 ${
                    isCurrent ? 'text-indigo-700 font-medium' : 'text-gray-400'
                  }`}
                >
                  {STEP_LABELS[step.step] ?? step.label}
                </span>
              </div>

              {/* Line */}
              {index < DETAIL_STEP_META.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 ${
                    currentStep > step.step ? 'bg-indigo-400' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
