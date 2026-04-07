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
  anyHovered: boolean;
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
  anyHovered,
  onClick,
  onHoverStart,
  onHoverEnd,
  index,
}: ActivityCardProps) {
  const shouldDesaturate = anyHovered && !isHovered;

  return (
    <motion.button
      onClick={onClick}
      onHoverStart={onHoverStart}
      onHoverEnd={onHoverEnd}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.15, duration: 0.4 }}
      whileHover={{ scale: 1.05, y: -8 }}
      whileTap={{ scale: 0.97 }}
      className={`
        relative flex flex-col items-center justify-center gap-4
        p-6 sm:p-8 rounded-2xl border-2 w-full
        transition-all duration-300
        ${isCompleted
          ? 'border-stamp-gold bg-stamp-gold/5'
          : isHovered
            ? 'border-primary bg-primary/5 shadow-lg'
            : 'border-border bg-card'
        }
        ${shouldDesaturate ? 'opacity-40 grayscale' : 'opacity-100'}
      `}
    >
      {/* Completed stamp overlay */}
      {isCompleted && (
        <div className="absolute top-3 right-3">
          <div className="w-8 h-8 rounded-full bg-stamp-gold flex items-center justify-center shadow-sm">
            <span className="text-white text-sm font-bold">&#10003;</span>
          </div>
        </div>
      )}

      {/* Icon */}
      <span className="text-4xl sm:text-5xl">{icon}</span>

      {/* Title */}
      <h3 className="text-base sm:text-lg font-bold text-foreground text-center">
        {title}
      </h3>

      {/* Stamp label */}
      <span
        className={`
          text-xs px-3 py-1 rounded-full font-medium
          ${isCompleted
            ? 'bg-stamp-gold/20 text-secondary-dark'
            : 'bg-muted-light text-muted'
          }
        `}
      >
        {stampLabel}
      </span>
    </motion.button>
  );
}
