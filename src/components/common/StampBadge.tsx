'use client';

import type { StampType } from '@/types/database';

interface StampBadgeProps {
  type: StampType;
  earned: boolean;
  size?: 'sm' | 'md' | 'lg';
  countryFlag?: string;
}

const stampLabels: Record<StampType, string> = {
  read: '읽기',
  hidden: '탐험',
  questions: '질문만들기',
  mystory: '내 이야기',
};

const stampIcons: Record<StampType, string> = {
  read: '📖',
  hidden: '🔍',
  questions: '❓',
  mystory: '✍️',
};

const sizeClasses = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-12 h-12 text-sm',
  lg: 'w-16 h-16 text-base',
};

const flagSizeClasses = {
  sm: 'text-[8px] -bottom-0.5 -right-0.5',
  md: 'text-xs -bottom-0.5 -right-0.5',
  lg: 'text-sm -bottom-1 -right-1',
};

export default function StampBadge({ type, earned, size = 'md', countryFlag }: StampBadgeProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <div
          className={`
            ${sizeClasses[size]}
            rounded-full flex items-center justify-center
            transition-all duration-300
            ${
              earned
                ? 'bg-stamp-gold border-2 border-secondary-dark shadow-md'
                : 'bg-transparent border-2 border-dashed border-muted opacity-50'
            }
          `}
          title={`${stampLabels[type]} ${earned ? '완료' : '미완료'}`}
        >
          <span className={earned ? '' : 'grayscale'}>
            {stampIcons[type]}
          </span>
        </div>
        {earned && countryFlag && (
          <span
            className={`absolute ${flagSizeClasses[size]} leading-none`}
            aria-label="country flag"
          >
            {countryFlag}
          </span>
        )}
      </div>
      <span
        className={`text-xs ${earned ? 'text-foreground font-medium' : 'text-muted'}`}
      >
        {stampLabels[type]}
      </span>
    </div>
  );
}
