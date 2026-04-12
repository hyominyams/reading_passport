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
  const completedAndResting = isCompleted && !isHovered && !isLocked;

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
              ? 'border-red-700/40 bg-red-50/50 shadow-lg'
              : 'border-slate-200 bg-slate-50'
            : isHovered
              ? 'border-primary bg-primary/5 shadow-lg'
              : 'border-primary/30 bg-white shadow-sm'
        }
        ${completedAndResting ? 'grayscale opacity-75' : ''}
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

      {/* Completed stamp overlay — passport style */}
      {isCompleted && !isLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="rotate-[-14deg] w-[76px] h-[76px] rounded-full border-[3px] border-red-700/60 flex items-center justify-center relative">
            {/* Inner ring */}
            <div className="absolute inset-[4px] rounded-full border-[1.5px] border-red-700/40" />
            {/* Stamp content */}
            <div className="flex flex-col items-center gap-0 z-10">
              <span className="text-red-700/70 text-[7px] font-bold tracking-[0.15em] uppercase leading-none">
                ★ WORLD DOCENT ★
              </span>
              <span className="text-red-700/70 text-[17px] font-black tracking-[0.08em] uppercase leading-tight mt-0.5">
                SUCCESS
              </span>
              <span className="text-red-700/70 text-[6px] font-semibold tracking-[0.2em] uppercase leading-none mt-px">
                APPROVED
              </span>
            </div>
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
                ? 'bg-red-100 text-red-700'
                : 'bg-slate-200 text-slate-500'
              : 'bg-primary/10 text-primary'
          }
        `}
      >
        {isLocked ? '도장 1~3을 먼저 완료하세요' : stampLabel}
      </span>
    </motion.button>
  );
}
