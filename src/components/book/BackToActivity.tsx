'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackToActivityProps {
  bookId: string;
  language: string;
}

export default function BackToActivity({ bookId, language }: BackToActivityProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(`/book/${bookId}/activity?lang=${language}`)}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border bg-white px-4 py-2 text-sm font-medium text-muted hover:bg-muted-light hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-4 w-4" />
      돌아가기
    </button>
  );
}
