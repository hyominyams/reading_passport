'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

export type ActiveGenerationToastState = {
  storyId: string;
  status: 'completed' | 'failed';
  title: string;
  href: string;
  errorMessage?: string | null;
};

interface ActiveGenerationToastProps {
  toast: ActiveGenerationToastState | null;
  isReviewPage: boolean;
  onClose: () => void;
}

export default function ActiveGenerationToast({
  toast,
  isReviewPage,
  onClose,
}: ActiveGenerationToastProps) {
  return (
    <AnimatePresence>
      {toast && !isReviewPage && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-sm rounded-2xl border border-border bg-white p-4 shadow-xl sm:bottom-6"
        >
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                toast.status === 'completed'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-red-50 text-red-600'
              }`}
            >
              {toast.status === 'completed' ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground">
                {toast.status === 'completed' ? '그림책이 완성됐어요' : '그림책 제작을 멈췄어요'}
              </p>
              <p className="mt-1 truncate text-xs text-muted">{toast.title}</p>
              {toast.status === 'failed' && toast.errorMessage && (
                <p className="mt-1 text-xs text-red-600">{toast.errorMessage}</p>
              )}
              <div className="mt-3 flex items-center gap-2">
                <Link
                  href={toast.href}
                  onClick={onClose}
                  className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-xs font-semibold text-white transition-colors hover:bg-foreground/90"
                >
                  {toast.status === 'completed' ? '보러가기' : '다시 열기'}
                </Link>
                {toast.status === 'failed' && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted">
                    <Loader2 className="h-3 w-3" />
                    이어서 다시 시도할 수 있어요
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted-light hover:text-foreground"
              aria-label="알림 닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
