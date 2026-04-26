'use client';

import { motion } from 'framer-motion';
import { LockKeyhole } from 'lucide-react';
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
        min-h-[220px] overflow-hidden p-6 sm:p-8 rounded-2xl border-2 w-full
        transition-all duration-300
        ${isLocked
          ? 'border-slate-900 bg-slate-100 cursor-not-allowed shadow-[inset_0_0_0_1px_rgba(15,23,42,0.22)]'
          : isCompleted
            ? isHovered
              ? 'border-red-200 bg-red-50/60 shadow-lg'
              : 'border-green-200 bg-green-50/40 shadow-sm'
            : isHovered
              ? 'border-primary bg-primary/5 shadow-lg'
              : 'border-primary/30 bg-white shadow-sm'
        }
        ${isLocked ? 'text-slate-400' : 'text-foreground'}
      `}
      aria-disabled={isLocked}
    >
      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 rounded-2xl border-[3px] border-slate-950 bg-slate-950/88 px-5 text-center text-white">
          <div className="absolute left-4 top-4 rounded-full border border-white/30 bg-white/12 px-3 py-1 text-[11px] font-black tracking-[0.12em] text-white">
            잠김
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-white bg-white text-slate-950 shadow-lg">
            <LockKeyhole className="h-9 w-9" strokeWidth={2.6} aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-black leading-tight">{title}</p>
            <p className="mt-2 rounded-full border border-white/35 bg-white px-4 py-1.5 text-sm font-black text-slate-950">
              Step 1~3 완료 후 열림
            </p>
          </div>
        </div>
      )}

      {/* Completed stamp — top-right corner, passport style */}
      {isCompleted && !isLocked && (
        <div className="absolute -top-3 -right-3 pointer-events-none z-10">
          <div className="rotate-[12deg] w-14 h-14 rounded-full border-[3px] border-red-600 bg-white flex items-center justify-center shadow-md">
            <div className="absolute inset-[3px] rounded-full border-[1.5px] border-red-600" />
            <div className="flex flex-col items-center z-10">
              <span className="text-red-600 text-[5px] font-bold tracking-[0.1em] uppercase leading-none">
                WORLD STORY
              </span>
              <span className="text-red-600 text-[11px] font-black uppercase leading-tight">
                CLEAR
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Icon */}
      <span className={`text-4xl sm:text-5xl ${isLocked ? 'opacity-20 grayscale' : ''}`}>{icon}</span>

      {/* Title */}
      <h3 className={`text-base sm:text-lg font-bold text-center ${isLocked ? 'opacity-20' : ''}`}>
        {title}
      </h3>

      {/* Stamp label */}
      <span
        className={`
          text-xs px-3 py-1 rounded-full font-medium
          ${isLocked
            ? 'bg-slate-900 text-white'
            : isCompleted
              ? 'bg-green-100 text-green-700'
              : 'bg-primary/10 text-primary'
          }
        `}
      >
        {isLocked
          ? 'Step 1~3 완료 후 열림'
          : isCompleted
            ? `${stampLabel} ✓`
            : stampLabel}
      </span>
    </motion.button>
  );
}
