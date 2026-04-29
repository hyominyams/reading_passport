'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function PanelLoading() {
  return (
    <div className="flex justify-center py-12">
      <LoadingSpinner message="불러오는 중..." />
    </div>
  );
}

const AdminOverview = dynamic(() => import('@/components/admin/AdminOverview'), {
  loading: PanelLoading,
});
const TeacherList = dynamic(() => import('@/components/admin/TeacherList'), {
  loading: PanelLoading,
});
const ApprovalQueue = dynamic(() => import('@/components/admin/ApprovalQueue'), {
  loading: PanelLoading,
});
const BookManager = dynamic(() => import('@/components/admin/BookManager'), {
  loading: PanelLoading,
});
const HiddenContentManager = dynamic(() => import('@/components/admin/HiddenContentManager'), {
  loading: PanelLoading,
});
const LibraryAdmin = dynamic(() => import('@/components/admin/LibraryAdmin'), {
  loading: PanelLoading,
});
const FactsManager = dynamic(() => import('@/components/admin/FactsManager'), {
  loading: PanelLoading,
});
const WorldSmartManagementPanel = dynamic(() => import('@/components/world-smart/WorldSmartManagementPanel'), {
  loading: PanelLoading,
});

type Tab = 'overview' | 'teachers' | 'approvals' | 'books' | 'worldSmart' | 'hidden' | 'library' | 'facts';

const tabs: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: '운영 현황', icon: '📊' },
  { key: 'teachers', label: '교사 관리', icon: '👩‍🏫' },
  { key: 'approvals', label: '승인 검토', icon: '✅' },
  { key: 'books', label: '도서 관리', icon: '📚' },
  { key: 'worldSmart', label: '질문 게시판', icon: '❓' },
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
            교사 관리, 승인 검토, 전역 콘텐츠 운영, 서재 관리, 세계 상식까지 한 흐름으로 볼 수 있습니다.
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
        {activeTab === 'worldSmart' && <WorldSmartManagementPanel mode="admin" />}
        {activeTab === 'hidden' && <HiddenContentManager />}
        {activeTab === 'library' && <LibraryAdmin />}
        {activeTab === 'facts' && <FactsManager />}
      </section>
    </main>
  );
}
