'use client';

import { Suspense } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import StylePageContent from './StylePageContent';

export default function StylePage() {
  return (
    <>
      <Header />
      <Suspense
        fallback={
          <main className="flex-1 flex items-center justify-center">
            <LoadingSpinner message="로딩 중..." />
          </main>
        }
      >
        <StylePageContent />
      </Suspense>
    </>
  );
}
