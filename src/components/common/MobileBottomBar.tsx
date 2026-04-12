'use client';

import Link from 'next/link';
import { Globe, BookOpen, IdCard, User, Menu, Megaphone } from 'lucide-react';

interface MobileBottomBarProps {
  pathname: string;
  role: string | null;
  isSidebarOpen: boolean;
  onMenuToggle: () => void;
}

export default function MobileBottomBar({ pathname, role, isSidebarOpen, onMenuToggle }: MobileBottomBarProps) {
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const thirdItem = role === 'student'
    ? { href: '/passport', icon: IdCard, label: '여권' }
    : { href: '/campaign', icon: Megaphone, label: '캠페인' };

  const items = [
    { href: '/map', icon: Globe, label: '세계지도' },
    { href: '/library', icon: BookOpen, label: '도서관' },
    thirdItem,
    { href: '/mypage', icon: User, label: '마이페이지' },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-md border-t border-border/60"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
                active ? 'text-foreground' : 'text-muted'
              }`}
            >
              <Icon className="w-6 h-6" strokeWidth={active ? 2 : 1.5} />
              {active && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-foreground" />
              )}
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onMenuToggle}
          aria-label="메뉴"
          aria-expanded={isSidebarOpen}
          className={`relative flex items-center justify-center w-12 h-12 rounded-xl transition-colors ${
            isSidebarOpen ? 'text-foreground' : 'text-muted'
          }`}
        >
          <Menu className="w-6 h-6" strokeWidth={isSidebarOpen ? 2 : 1.5} />
          {isSidebarOpen && (
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-foreground" />
          )}
        </button>
      </div>
    </nav>
  );
}
