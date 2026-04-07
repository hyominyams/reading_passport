'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const { profile, role, isAuthenticated, signOut } = useAuth();

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <Link href={isAuthenticated ? '/map' : '/'} className="flex items-center gap-2">
            <span className="text-xl font-bold text-primary">World Docent</span>
            <span className="text-sm text-muted hidden sm:inline">글로벌 독서 여행</span>
          </Link>

          {isAuthenticated && (
            <nav className="flex items-center gap-4">
              <Link
                href="/map"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                세계지도
              </Link>
              <Link
                href="/library"
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                도서관
              </Link>

              {role === 'student' && (
                <Link
                  href="/passport"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  여권
                </Link>
              )}

              {(role === 'teacher' || role === 'admin') && (
                <Link
                  href="/teacher"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  교사 관리
                </Link>
              )}

              {role === 'admin' && (
                <Link
                  href="/admin"
                  className="text-sm text-muted hover:text-foreground transition-colors"
                >
                  관리자
                </Link>
              )}

              <div className="flex items-center gap-2 ml-2 pl-4 border-l border-border">
                <span className="text-sm font-medium">
                  {profile?.nickname ?? profile?.email ?? '사용자'}
                </span>
                <button
                  onClick={signOut}
                  className="text-xs text-muted hover:text-error transition-colors"
                >
                  로그아웃
                </button>
              </div>
            </nav>
          )}
        </div>
      </div>
    </header>
  );
}
