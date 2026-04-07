'use client';

import { motion } from 'framer-motion';

interface CollectionItem {
  key: string;
  label: string;
  collected: boolean;
  color: string;
}

interface GaugeBarProps {
  percentage: number;
  items: CollectionItem[];
  showHint?: boolean;
}

export default function GaugeBar({ percentage, items, showHint }: GaugeBarProps) {
  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className="flex flex-col items-center h-full py-4">
      <h3 className="text-sm font-bold text-foreground mb-3">이야기 재료</h3>

      {/* Vertical gauge container */}
      <div className="relative flex-1 w-12 bg-muted-light rounded-full overflow-hidden border border-border">
        {/* Fill */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 rounded-full"
          style={{
            background: 'linear-gradient(to top, #3b82f6, #8b5cf6, #ec4899)',
          }}
          initial={{ height: '0%' }}
          animate={{ height: `${clampedPercentage}%` }}
          transition={{ type: 'spring', stiffness: 60, damping: 15 }}
        />

        {/* Percentage label */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold text-foreground bg-white/80 rounded px-1">
            {Math.round(clampedPercentage)}%
          </span>
        </div>
      </div>

      {/* Collection items */}
      <div className="mt-4 space-y-2 w-full">
        {items.map((item) => (
          <div
            key={item.key}
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all
              ${item.collected ? 'bg-success/10 text-success' : 'bg-muted-light text-muted'}
            `}
          >
            <div
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                item.collected ? 'bg-success' : 'bg-border'
              }`}
              style={item.collected ? { backgroundColor: item.color } : {}}
            />
            <span className="truncate font-medium">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Hint message */}
      {showHint && (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs text-center text-secondary font-medium mt-3 px-1"
        >
          이야기를 제출하면 더 좋은 이야기가 나와요!
        </motion.p>
      )}
    </div>
  );
}
