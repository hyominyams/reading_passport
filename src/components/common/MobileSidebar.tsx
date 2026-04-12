'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Globe, BookOpen, IdCard, User, X, Megaphone,
  GraduationCap, Settings, LogOut,
} from 'lucide-react';
import { buildAutoNickname, getAvatarEmoji } from '@/lib/profile';
import type { UserRole } from '@/types/database';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  profile: { nickname?: string | null; school?: string | null; grade?: number | null; class_number?: number | null; email?: string | null; avatar?: string | null; name?: string | null } | null;
  role: UserRole | null;
  onSignOut: () => Promise<void>;
}

const allNavItems = [
  { href: '/map', icon: Globe, label: '세계지도' },
  { href: '/library', icon: BookOpen, label: '도서관' },
  { href: '/campaign', icon: Megaphone, label: '캠페인' },
  { href: '/passport', icon: IdCard, label: '여권', roles: ['student'] as string[] },
  { href: '/teacher', icon: GraduationCap, label: '교사 관리', roles: ['teacher', 'admin'] as string[] },
  { href: '/admin', icon: Settings, label: '관리자', roles: ['admin'] as string[] },
  { href: '/mypage', icon: User, label: '마이페이지' },
];

export default function MobileSidebar({ isOpen, onClose, profile, role, onSignOut }: MobileSidebarProps) {
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);

  const displayName = profile ? buildAutoNickname(profile as Parameters<typeof buildAutoNickname>[0]) : '';
  const avatarEmoji = getAvatarEmoji(profile?.avatar);
  const initial = displayName.charAt(0) || profile?.email?.charAt(0) || '?';

  const navItems = allNavItems.filter((item) => {
    if (!item.roles) return true;
    return role && item.roles.includes(role);
  });

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await onSignOut();
    } catch {
      setSigningOut(false);
    }
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  const roleBadge = role === 'admin' ? '관리자' : role === 'teacher' ? '교사' : '학생';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.aside
            className="fixed right-0 top-0 bottom-0 w-72 bg-white z-50 md:hidden flex flex-col shadow-xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            role="dialog"
            aria-modal="true"
            aria-label="네비게이션 메뉴"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 h-14 border-b border-border/60">
              <span className="text-sm font-heading font-semibold text-foreground">메뉴</span>
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="메뉴 닫기"
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile */}
            <div className="px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-foreground/[0.08] text-foreground flex items-center justify-center text-base font-medium shrink-0">
                  {avatarEmoji ? <span className="text-lg">{avatarEmoji}</span> : initial}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{displayName || '사용자'}</p>
                  <span className="inline-block mt-0.5 text-[11px] px-1.5 py-0.5 rounded bg-foreground/[0.06] text-muted font-medium">
                    {roleBadge}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-2 px-3">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      active
                        ? 'text-foreground font-medium bg-foreground/[0.06]'
                        : 'text-muted hover:text-foreground hover:bg-foreground/[0.04]'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2 : 1.5} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* Sign out */}
            <div className="px-3 py-3 border-t border-border/60">
              <button
                type="button"
                onClick={() => { void handleSignOut(); }}
                disabled={signingOut}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-muted hover:text-foreground hover:bg-foreground/[0.04] transition-colors disabled:opacity-50"
              >
                <LogOut className="w-5 h-5 shrink-0" strokeWidth={1.5} />
                {signingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
