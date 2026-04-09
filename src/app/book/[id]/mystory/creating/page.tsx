'use client';

import { Suspense } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import CreatingPageContent from './CreatingPageContent';

export default function CreatingPage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="flex-1 flex items-center justify-center min-h-[60vh]">
            <LoadingSpinner message="로딩 중..." />
          </main>
        }
      >
        <CreatingPageContent />
      </Suspense>
    </>
  );
}
