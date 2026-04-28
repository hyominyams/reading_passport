'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const POLL_INTERVAL = 30000;

type ActiveProduction = {
  storyId: string;
  bookId: string;
  language: string;
  currentStep: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string | null;
  title: string;
  href: string;
  startedAt: string;
};

type ActiveProductionResponse = {
  activeProduction: ActiveProduction | null;
  error?: string;
};

type ToastState = {
  storyId: string;
  status: 'completed' | 'failed';
  title: string;
  href: string;
  errorMessage?: string | null;
};

function getSeenKey(storyId: string, status: 'completed' | 'failed') {
  return `world-docent-production-${storyId}-${status}`;
}

function hasSeenToast(storyId: string, status: 'completed' | 'failed') {
  if (typeof window === 'undefined') return true;
  return window.sessionStorage.getItem(getSeenKey(storyId, status)) === '1';
}

function markSeenToast(storyId: string, status: 'completed' | 'failed') {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(getSeenKey(storyId, status), '1');
}

export default function ActiveGenerationProvider({ children }: { children: ReactNode }) {
  const { isStudent, loading } = useAuth();
  const pathname = usePathname();
  const [toast, setToast] = useState<ToastState | null>(null);
  const lastObservedStatusRef = useRef<Map<string, ActiveProduction['status']>>(new Map());
  const isReviewPage = pathname.includes('/mystory/finish');

  const checkActiveProduction = useCallback(async () => {
    if (loading || !isStudent) {
      return;
    }

    try {
      const response = await fetch('/api/story/active-production', {
        cache: 'no-store',
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as ActiveProductionResponse;
      const activeProduction = payload.activeProduction;

      if (!activeProduction) {
        return;
      }

      const previousStatus = lastObservedStatusRef.current.get(activeProduction.storyId);
      lastObservedStatusRef.current.set(activeProduction.storyId, activeProduction.status);

      if (activeProduction.status !== 'completed' && activeProduction.status !== 'failed') {
        return;
      }

      const cameFromProcessing =
        previousStatus === 'processing' || previousStatus === 'pending';
      const shouldShowExistingCompleted =
        previousStatus === undefined && !pathname.includes('/mystory/finish');

      if (!cameFromProcessing && !shouldShowExistingCompleted) {
        return;
      }

      if (hasSeenToast(activeProduction.storyId, activeProduction.status)) {
        return;
      }

      markSeenToast(activeProduction.storyId, activeProduction.status);
      setToast({
        storyId: activeProduction.storyId,
        status: activeProduction.status,
        title: activeProduction.title,
        href: activeProduction.href,
        errorMessage: activeProduction.errorMessage,
      });
    } catch {
      // 다음 폴링에서 다시 확인합니다.
    }
  }, [isStudent, loading, pathname]);

  useEffect(() => {
    if (loading || !isStudent) {
      return;
    }

    const initialCheckId = window.setTimeout(() => {
      void checkActiveProduction();
    }, 0);
    const intervalId = window.setInterval(() => {
      void checkActiveProduction();
    }, POLL_INTERVAL);

    return () => {
      window.clearTimeout(initialCheckId);
      window.clearInterval(intervalId);
    };
  }, [checkActiveProduction, isStudent, loading]);

  return (
    <>
      {children}

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
                    onClick={() => setToast(null)}
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
                onClick={() => setToast(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-muted-light hover:text-foreground"
                aria-label="알림 닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
