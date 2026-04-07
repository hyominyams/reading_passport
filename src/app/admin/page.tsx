'use client';

import { useState } from 'react';
import TeacherList from '@/components/admin/TeacherList';
import ApprovalQueue from '@/components/admin/ApprovalQueue';
import BookManager from '@/components/admin/BookManager';
import LibraryAdmin from '@/components/admin/LibraryAdmin';

type Section = 'teachers' | 'approvals' | 'books' | 'library';

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState<Section>('teachers');

  const sections: { key: Section; label: string; icon: string }[] = [
    { key: 'teachers', label: '교사 관리', icon: '\uD83D\uDC69\u200D\uD83C\uDFEB' },
    { key: 'approvals', label: '콘텐츠 승인', icon: '\u2705' },
    { key: 'books', label: '도서/콘텐츠 관리', icon: '\uD83D\uDCDA' },
    { key: 'library', label: '도서관 관리', icon: '\uD83C\uDFE0' },
  ];

  const sectionDescriptions: Record<Section, string> = {
    teachers: '등록된 교사를 조회하고 관리합니다',
    approvals: '교사들의 콘텐츠 전체 공개 요청을 승인하거나 반려합니다',
    books: '글로벌 도서를 등록하고 관리합니다',
    library: '학생 작품 도서관을 관리합니다',
  };

  return (
    <div className="flex min-h-[calc(100vh-56px)]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-border shrink-0 hidden md:block">
        <div className="p-4">
          <h2 className="text-sm font-bold text-muted uppercase tracking-wider mb-4">
            관리자 메뉴
          </h2>
          <nav className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.key}
                onClick={() => setActiveSection(section.key)}
                className={`w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeSection === section.key
                    ? 'bg-primary/5 text-primary font-medium'
                    : 'text-muted hover:bg-muted-light hover:text-foreground'
                }`}
              >
                <span>{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-border z-40">
        <div className="flex">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={`flex-1 flex flex-col items-center gap-1 py-2 text-xs transition-colors ${
                activeSection === section.key
                  ? 'text-primary font-medium'
                  : 'text-muted'
              }`}
            >
              <span className="text-lg">{section.icon}</span>
              <span className="truncate px-1">{section.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 p-6 md:p-8 pb-20 md:pb-8">
        <div className="max-w-5xl mx-auto">
          {/* Section header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-foreground">
              {sections.find((s) => s.key === activeSection)?.icon}{' '}
              {sections.find((s) => s.key === activeSection)?.label}
            </h1>
            <p className="text-sm text-muted mt-1">
              {sectionDescriptions[activeSection]}
            </p>
          </div>

          {/* Section content */}
          {activeSection === 'teachers' && <TeacherList />}
          {activeSection === 'approvals' && <ApprovalQueue />}
          {activeSection === 'books' && <BookManager />}
          {activeSection === 'library' && <LibraryAdmin />}
        </div>
      </main>
    </div>
  );
}
