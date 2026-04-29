'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { ActiveGenerationToastState } from './ActiveGenerationToast';

const POLL_INTERVAL = 30000;
const FETCH_TIMEOUT_MS = 10000;

const ActiveGenerationToast = dynamic(() => import('./ActiveGenerationToast'), {
  ssr: false,
});

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
  const [toast, setToast] = useState<ActiveGenerationToastState | null>(null);
  const lastObservedStatusRef = useRef<Map<string, ActiveProduction['status']>>(new Map());
  const isReviewPage = pathname.includes('/mystory/finish');

  const checkActiveProduction = useCallback(async () => {
    if (loading || !isStudent) {
      return;
    }

    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch('/api/story/active-production', {
        cache: 'no-store',
        signal: controller.signal,
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
    } finally {
      window.clearTimeout(timeoutId);
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
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkActiveProduction();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearTimeout(initialCheckId);
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkActiveProduction, isStudent, loading]);

  return (
    <>
      {children}

      {toast && (
        <ActiveGenerationToast
          toast={toast}
          isReviewPage={isReviewPage}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
