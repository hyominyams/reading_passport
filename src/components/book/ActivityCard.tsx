'use client';

import { motion } from 'framer-motion';
import type { StampType } from '@/types/database';

interface ActivityCardProps {
  icon: string;
  title: string;
  stampLabel: string;
  stampType: StampType;
  isCompleted: boolean;
  isHovered: boolean;
  isLocked?: boolean;
  onClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  index: number;
}

export default function ActivityCard({
  icon,
  title,
  stampLabel,
  isCompleted,
  isHovered,
  isLocked = false,
  onClick,
  onHoverStart,
  onHoverEnd,
  index,
}: ActivityCardProps) {
  const isInactive = !isHovered && !isLocked;

  return (
    <motion.button
      onClick={() => { if (!isLocked) onClick(); }}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4 }}
      whileHover={isLocked ? undefined : { scale: 1.05, y: -8 }}
      whileTap={isLocked ? undefined : { scale: 0.97 }}
      className={`
        relative flex flex-col items-center justify-center gap-4
        p-6 sm:p-8 rounded-2xl border-2 w-full
        transition-all duration-300
        ${isLocked
          ? 'border-border bg-slate-100 opacity-50 grayscale cursor-not-allowed'
          : isCompleted
            ? isHovered
              ? 'border-stamp-gold bg-stamp-gold/10 shadow-lg'
              : 'border-border bg-slate-100'
            : isHovered
              ? 'border-primary bg-primary/5 shadow-lg'
              : 'border-border bg-slate-100'
        }
        ${!isLocked && isInactive ? 'grayscale text-slate-500' : ''}
        ${!isLocked && isInactive ? 'opacity-65' : ''}
        ${isLocked ? 'text-slate-400' : 'text-foreground'}
      `}
    >
      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl">
          <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
      )}

      {/* Completed stamp overlay */}
      {isCompleted && !isLocked && (
        <div className="absolute top-3 right-3">
          <div className="w-8 h-8 rounded-full bg-stamp-gold flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">&#10003;</span>
          </div>
        </div>
      )}

      {/* Icon */}
      <span className={`text-4xl sm:text-5xl ${isLocked ? 'opacity-30' : ''}`}>{icon}</span>

      {/* Title */}
      <h3 className={`text-base sm:text-lg font-bold text-center ${isLocked ? 'opacity-30' : ''}`}>
        {title}
      </h3>

      {/* Stamp label */}
      <span
        className={`
          text-xs px-3 py-1 rounded-full font-medium
          ${isLocked
            ? 'bg-slate-200 text-slate-400'
            : isCompleted
              ? isHovered
                ? 'bg-stamp-gold/20 text-secondary-dark'
                : 'bg-slate-200 text-slate-500'
              : isHovered
                ? 'bg-muted-light text-muted'
                : 'bg-slate-200 text-slate-500'
          }
        `}
      >
        {isLocked ? '도장 1~3을 먼저 완료하세요' : stampLabel}
      </span>
    </motion.button>
  );
}
