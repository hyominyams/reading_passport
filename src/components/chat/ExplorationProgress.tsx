'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface ExplorationProgressProps {
  viewed: number;
  total: number;
  canComplete: boolean;
  completed: boolean;
  onComplete: () => void;
  isCompleting: boolean;
}

export default function ExplorationProgress({
  viewed,
  total,
  canComplete,
  completed,
  onComplete,
  isCompleting,
}: ExplorationProgressProps) {
  const percentage = total > 0 ? Math.round((viewed / total) * 100) : 0;

  return (
    <div className="bg-white border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-foreground">탐험 진행도</h3>
        <span className="text-xs text-muted">
          {viewed}/{total} 확인함
        </span>
      </div>

      <div className="w-full h-2 bg-muted-light rounded-full overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${completed ? 'bg-success' : 'bg-primary'}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <AnimatePresence>
        {completed ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="flex items-center gap-2 text-sm text-success font-medium"
          >
            <span>🔍</span>
            <span>탐험 완료! 스탬프를 획득했어요!</span>
          </motion.div>
        ) : canComplete ? (
          <motion.button
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={onComplete}
            disabled={isCompleting}
            className="w-full py-2.5 bg-secondary text-white text-sm font-bold rounded-xl hover:bg-secondary-dark disabled:opacity-50 transition-colors"
          >
            {isCompleting ? '처리 중...' : '🔍 탐험 스탬프 받기'}
          </motion.button>
        ) : (
          <p className="text-xs text-muted text-center">
            콘텐츠의 70% 이상을 확인하면 스탬프를 받을 수 있어요
          </p>
        )}
      </AnimatePresence>
    </div>
  );
}
