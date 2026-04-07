'use client';

import type { Visibility } from '@/types/database';

interface VisibilitySelectorProps {
  value: Visibility;
  onChange: (v: Visibility) => void;
}

const options: { value: Visibility; label: string; description: string; icon: string }[] = [
  {
    value: 'public',
    label: '전체 공개',
    description: '모든 사람이 볼 수 있어요',
    icon: '🌍',
  },
  {
    value: 'class',
    label: '우리 반만',
    description: '같은 반 친구들만 볼 수 있어요',
    icon: '🏫',
  },
  {
    value: 'private',
    label: '나만 보기',
    description: '나만 볼 수 있어요',
    icon: '🔒',
  },
];

export default function VisibilitySelector({ value, onChange }: VisibilitySelectorProps) {
  return (
    <div className="flex gap-3">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`
            flex-1 p-3 rounded-xl border-2 text-left transition-all
            ${
              value === opt.value
                ? 'border-primary bg-primary/5'
                : 'border-border bg-card hover:border-primary/40'
            }
          `}
        >
          <span className="text-xl">{opt.icon}</span>
          <p className="text-sm font-bold text-foreground mt-1">{opt.label}</p>
          <p className="text-xs text-muted mt-0.5">{opt.description}</p>
        </button>
      ))}
    </div>
  );
}
