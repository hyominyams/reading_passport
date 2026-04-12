'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import MobileBottomBar from './MobileBottomBar';
import MobileSidebar from './MobileSidebar';

export default function MobileNav() {
  const { isAuthenticated, profile, role, signOut } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Hide nav on standalone guide pages (opened in new tab)
  if (pathname.startsWith('/guide')) return null;
  if (!isAuthenticated) return null;

  return (
    <div className="md:hidden">
      {/* Spacer so page content doesn't hide behind the fixed bottom bar */}
      <div className="h-14" />

      <MobileBottomBar
        pathname={pathname}
        role={role}
        isSidebarOpen={sidebarOpen}
        onMenuToggle={() => setSidebarOpen((v) => !v)}
      />

      <MobileSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        profile={profile}
        role={role}
        onSignOut={signOut}
      />
    </div>
  );
}
