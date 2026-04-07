'use client';

import { Suspense } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import CharactersPageContent from './CharactersPageContent';

export default function CharactersPage() {
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
        <CharactersPageContent />
      </Suspense>
    </>
  );
}
