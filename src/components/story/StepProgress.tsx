'use client';

const STEPS = [
  { num: 1, label: '질문' },
  { num: 2, label: '쓰기' },
  { num: 3, label: '초안' },
  { num: 4, label: '장면' },
  { num: 5, label: '주인공' },
  { num: 6, label: '표지' },
  { num: 7, label: '제작' },
  { num: 8, label: '완성' },
];

interface StepProgressProps {
  currentStep: number;
}

export default function StepProgress({ currentStep }: StepProgressProps) {
  return (
    <div className="w-full max-w-2xl mx-auto mb-6">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = currentStep > step.num;
          const isCurrent = currentStep === step.num;

          return (
            <div key={step.num} className="flex items-center flex-1 last:flex-none">
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
                  {isCompleted ? '✓' : step.num}
                </div>
                <span
                  className={`text-[10px] mt-1 ${
                    isCurrent ? 'text-indigo-700 font-medium' : 'text-gray-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Line */}
              {index < STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-1 ${
                    currentStep > step.num ? 'bg-indigo-400' : 'bg-gray-200'
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
