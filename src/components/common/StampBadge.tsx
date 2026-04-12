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

const sizeConfig = {
  sm: { outer: 'w-8 h-8', icon: 'text-xs', ring: 'border-[1.5px]', inner: 'inset-[2px] border-[0.75px]', label: 'text-[5px]' },
  md: { outer: 'w-12 h-12', icon: 'text-sm', ring: 'border-2', inner: 'inset-[3px] border-[1px]', label: 'text-[6px]' },
  lg: { outer: 'w-16 h-16', icon: 'text-base', ring: 'border-[2.5px]', inner: 'inset-[4px] border-[1.5px]', label: 'text-[7px]' },
};

const flagSizeClasses = {
  sm: 'text-[8px] -bottom-0.5 -right-0.5',
  md: 'text-xs -bottom-0.5 -right-0.5',
  lg: 'text-sm -bottom-1 -right-1',
};

export default function StampBadge({ type, earned, size = 'md', countryFlag }: StampBadgeProps) {
  const cfg = sizeConfig[size];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        <div
          className={`
            ${cfg.outer}
            rounded-full flex items-center justify-center relative
            transition-all duration-300 rotate-[-8deg]
            ${
              earned
                ? `${cfg.ring} border-red-700/60 bg-white shadow-md`
                : 'border-2 border-dashed border-muted bg-transparent opacity-50'
            }
          `}
          title={`${stampLabels[type]} ${earned ? '완료' : '미완료'}`}
        >
          {/* Inner ring for earned stamps */}
          {earned && (
            <div className={`absolute ${cfg.inner} rounded-full border-red-700/40`} />
          )}
          <span className={`${cfg.icon} ${earned ? '' : 'grayscale'} z-10`}>
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
        className={`text-xs ${earned ? 'text-red-700 font-semibold' : 'text-muted'}`}
      >
        {stampLabels[type]}
      </span>
    </div>
  );
}
