'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function Header() {
  const { profile, role, isAuthenticated, signOut } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    { href: '/map', label: '세계지도' },
    { href: '/library', label: '도서관' },
    ...(role === 'student' ? [{ href: '/passport', label: '여권' }] : []),
    ...((role === 'teacher' || role === 'admin') ? [{ href: '/teacher', label: '교사 관리' }] : []),
    ...(role === 'admin' ? [{ href: '/admin', label: '관리자' }] : []),
  ];

  const initial = profile?.nickname?.charAt(0) ?? profile?.email?.charAt(0) ?? '?';

  return (
    <header className="bg-card/80 backdrop-blur-sm border-b border-border/50 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          <Link href={isAuthenticated ? '/map' : '/'} className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="text-xl font-heading text-primary">World Docent</span>
            <span className="text-xs text-muted hidden sm:inline">글로벌 독서 여행</span>
          </Link>

          {isAuthenticated && (
            <nav className="flex items-center gap-1 sm:gap-3">
              {navLinks.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`text-sm px-2 py-1 rounded-lg transition-colors ${
                      isActive
                        ? 'text-primary font-medium bg-primary/10'
                        : 'text-muted hover:text-foreground hover:bg-muted-light'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}

              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-border/50">
                <div className="w-7 h-7 rounded-full bg-secondary/20 text-secondary-dark flex items-center justify-center text-xs font-heading">
                  {initial}
                </div>
                <span className="text-sm font-medium hidden sm:inline">
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
