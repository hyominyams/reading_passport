'use client';

import { useState } from 'react';
import AdminOverview from '@/components/admin/AdminOverview';
import TeacherList from '@/components/admin/TeacherList';
import ApprovalQueue from '@/components/admin/ApprovalQueue';
import BookManager from '@/components/admin/BookManager';
import HiddenContentManager from '@/components/admin/HiddenContentManager';
import LibraryAdmin from '@/components/admin/LibraryAdmin';
import FactsManager from '@/components/admin/FactsManager';

type Tab = 'overview' | 'teachers' | 'approvals' | 'books' | 'hidden' | 'library' | 'facts';

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: '운영 현황', icon: '📊' },
  { key: 'teachers', label: '교사 관리', icon: '👩‍🏫' },
  { key: 'approvals', label: '승인 검토', icon: '✅' },
  { key: 'books', label: '도서 관리', icon: '📚' },
  { key: 'hidden', label: 'Hidden Stories', icon: '🔍' },
  { key: 'library', label: '서재 관리', icon: '🏠' },
  { key: 'facts', label: '세계 상식', icon: '🌍' },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-border bg-white shadow-sm">
        <div className="px-6 py-7 lg:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
            <span>🛡️</span>
            <span>Admin Control Center</span>
          </div>
          <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
            교사, 콘텐츠, 서재를 한 곳에서 관리하세요
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
            교사 관리, 승인 검토, 전역 콘텐츠 운영, 서재 moderation, 세계 상식까지 한 흐름으로 제어할 수 있습니다.
          </p>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-foreground text-white shadow-sm'
                : 'text-muted hover:bg-muted-light hover:text-foreground'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        {activeTab === 'overview' && <AdminOverview />}
        {activeTab === 'teachers' && <TeacherList />}
        {activeTab === 'approvals' && <ApprovalQueue />}
        {activeTab === 'books' && <BookManager />}
        {activeTab === 'hidden' && <HiddenContentManager />}
        {activeTab === 'library' && <LibraryAdmin />}
        {activeTab === 'facts' && <FactsManager />}
      </section>
    </main>
  );
}
