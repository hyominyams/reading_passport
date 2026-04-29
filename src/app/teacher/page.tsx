'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { User, Activity, Book, ChatLog } from '@/types/database';

import StudentTable from '@/components/teacher/StudentTable';
import LoadingSpinner from '@/components/common/LoadingSpinner';

function PanelLoading() {
  return (
    <div className="flex justify-center py-12">
      <LoadingSpinner message="불러오는 중..." />
    </div>
  );
}

const StudentDetail = dynamic(() => import('@/components/teacher/StudentDetail'), {
  loading: PanelLoading,
});
const ChatHistoryView = dynamic(() => import('@/components/teacher/ChatHistoryView'), {
  loading: PanelLoading,
});
const ContentManager = dynamic(() => import('@/components/teacher/ContentManager'), {
  loading: PanelLoading,
});
const StudentCreator = dynamic(() => import('@/components/teacher/StudentCreator'), {
  loading: PanelLoading,
});
const TeacherLibraryManager = dynamic(() => import('@/components/teacher/TeacherLibraryManager'), {
  loading: PanelLoading,
});
const ClassSettingsPanel = dynamic(() => import('@/components/teacher/ClassSettingsPanel'), {
  loading: PanelLoading,
});
const TeacherCampaignManager = dynamic(() => import('@/components/teacher/TeacherCampaignManager'), {
  loading: PanelLoading,
});
const WorldSmartManagementPanel = dynamic(() => import('@/components/world-smart/WorldSmartManagementPanel'), {
  loading: PanelLoading,
});

type Tab = 'overview' | 'worldSmart' | 'resources' | 'students' | 'library' | 'campaign' | 'settings';

// Level for the overview tab drill-down
type OverviewLevel = 'list' | 'detail' | 'chat';

interface StudentWithActivity extends User {
  allActivities: (Activity & { book?: Book })[];
  hasFlaggedChat?: boolean;
}

export default function TeacherPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // Overview state
  const [overviewLevel, setOverviewLevel] = useState<OverviewLevel>('list');
  const [students, setStudents] = useState<StudentWithActivity[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<StudentWithActivity | null>(null);
  const [selectedChat, setSelectedChat] = useState<ChatLog | null>(null);

  useEffect(() => {
    if (activeTab !== 'overview' || !user) return;

    let cancelled = false;

    void (async () => {
      const supabase = createClient();

      // Get all students for this teacher.
      const { data: studentsData } = await supabase
        .from('users')
        .select('*')
        .eq('teacher_id', user.id)
        .eq('role', 'student')
        .order('nickname', { ascending: true });

      if (cancelled) return;

      const studentList = (studentsData ?? []) as User[];
      const studentIds = studentList.map((s) => s.id);

      if (studentIds.length === 0) {
        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      // Get activities with books.
      const { data: activitiesData } = await supabase
        .from('activities')
        .select('*, book:books(*)')
        .in('student_id', studentIds)
        .order('created_at', { ascending: false });

      if (cancelled) return;

      // Get flagged chat info.
      const { data: flaggedChats } = await supabase
        .from('chat_logs')
        .select('student_id')
        .in('student_id', studentIds)
        .eq('flagged', true);

      if (cancelled) return;

      const activities = (activitiesData ?? []) as (Activity & { book?: Book })[];
      const flaggedStudentIds = new Set((flaggedChats ?? []).map((c: { student_id: string }) => c.student_id));

      // Map ALL activities per student (not just most recent).
      const studentActivitiesMap = new Map<string, (Activity & { book?: Book })[]>();
      for (const act of activities) {
        const list = studentActivitiesMap.get(act.student_id) ?? [];
        list.push(act);
        studentActivitiesMap.set(act.student_id, list);
      }

      const enriched: StudentWithActivity[] = studentList.map((s) => ({
        ...s,
        allActivities: studentActivitiesMap.get(s.id) ?? [],
        hasFlaggedChat: flaggedStudentIds.has(s.id),
      }));

      setStudents(enriched);
      setLoadingStudents(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, user]);

  const handleSelectStudent = (student: StudentWithActivity) => {
    setSelectedStudent(student);
    setOverviewLevel('detail');
  };

  const handleViewChat = (chatLog: ChatLog) => {
    setSelectedChat(chatLog);
    setOverviewLevel('chat');
  };

  const handleBackToList = () => {
    setSelectedStudent(null);
    setOverviewLevel('list');
  };

  const handleBackToDetail = () => {
    setSelectedChat(null);
    setOverviewLevel('detail');
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'overview', label: '반 전체 현황', icon: '\uD83D\uDCCA' },
    { key: 'worldSmart', label: '질문 게시판', icon: '\u2753' },
    { key: 'students', label: '계정 관리', icon: '\uD83D\uDC65' },
    { key: 'resources', label: '책/자료 관리', icon: '\uD83D\uDCDA' },
    { key: 'library', label: '도서관 관리', icon: '\uD83C\uDFE0' },
    { key: 'campaign', label: '캠페인', icon: '\uD83D\uDCE2' },
    { key: 'settings', label: '반 설정', icon: '\u2699\uFE0F' },
  ];

  const stats = useMemo(() => {
    const total = students.length;
    const active = students.filter((s) => s.allActivities.length > 0).length;
    const completedPages = students.reduce(
      (sum, s) => sum + s.allActivities.filter((a) => (a.stamps_earned?.length ?? 0) >= 4).length,
      0,
    );
    const avgPerStudent = total > 0 ? completedPages / total : 0;
    const flagged = students.filter((s) => s.hasFlaggedChat).length;
    const participationRate = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, active, completedPages, avgPerStudent, flagged, participationRate };
  }, [students]);

  const renderOverview = () => {
    if (loadingStudents) {
      return (
        <div className="flex justify-center py-12">
          <LoadingSpinner message="학생 현황을 불러오는 중..." />
        </div>
      );
    }

    switch (overviewLevel) {
      case 'list':
        return (
          <StudentTable
            students={students}
            onSelectStudent={handleSelectStudent}
          />
        );
      case 'detail':
        return selectedStudent ? (
          <StudentDetail
            student={selectedStudent}
            onBack={handleBackToList}
            onViewChat={handleViewChat}
          />
        ) : null;
      case 'chat':
        return selectedChat && selectedStudent ? (
          <ChatHistoryView
            chatLog={selectedChat}
            studentName={selectedStudent.nickname ?? '학생'}
            onBack={handleBackToDetail}
          />
        ) : null;
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-border bg-white shadow-sm">
        <div className="px-6 py-7 lg:px-8 space-y-6">
          {/* Header */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <span>🏫</span>
              <span>Teacher Dashboard</span>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
              학생 현황, 계정, 도서와 자료를 한 곳에서 관리하세요
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              학생 현황을 확인하고, 계정·도서·캠페인을 효율적으로 관리할 수 있습니다.
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* 전체 학생 + 참여율 게이지 */}
            <article className="group rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">전체 학생</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-base">👥</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.total}<span className="text-sm font-normal text-muted ml-0.5">명</span></p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-muted mb-1">
                  <span>참여율</span>
                  <span className="font-medium text-foreground">{stats.participationRate}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted-light overflow-hidden">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all duration-500"
                    style={{ width: `${stats.participationRate}%` }}
                  />
                </div>
              </div>
            </article>

            {/* 활동 참여 */}
            <article className="group rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">활동 참여</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-base">📘</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.active}<span className="text-sm font-normal text-muted ml-0.5">명</span></p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-muted mb-1">
                  <span>미참여</span>
                  <span className="font-medium text-foreground">{stats.total - stats.active}명</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted-light overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-400 transition-all duration-500"
                    style={{ width: `${stats.participationRate}%` }}
                  />
                </div>
              </div>
            </article>

            {/* 완성 여권 페이지 */}
            <article className="group rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">완성 여권 페이지</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-base">🛂</span>
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{stats.completedPages}<span className="text-sm font-normal text-muted ml-0.5">건</span></p>
              <p className="mt-2 text-[11px] text-muted">
                1인당 평균 <span className="font-semibold text-emerald-600">{stats.avgPerStudent.toFixed(1)}</span>건
              </p>
            </article>

            {/* 플래그 대화 */}
            <article className="group rounded-2xl border border-border bg-white p-4 transition-all duration-200 hover:shadow-md hover:scale-[1.02]">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">플래그 대화</p>
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-red-50 text-base">🚩</span>
              </div>
              <p className={`mt-2 text-2xl font-semibold ${stats.flagged > 0 ? 'text-error' : 'text-foreground'}`}>{stats.flagged}<span className="text-sm font-normal text-muted ml-0.5">건</span></p>
              <p className="mt-2 text-[11px] text-muted">
                {stats.flagged > 0 ? '확인이 필요합니다' : '이상 없음'}
              </p>
            </article>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto rounded-2xl border border-border bg-white p-2 shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              if (tab.key === 'overview') {
                setOverviewLevel('list');
                setSelectedStudent(null);
                setSelectedChat(null);
              }
            }}
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
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'worldSmart' && <WorldSmartManagementPanel mode="teacher" />}
        {activeTab === 'resources' && <ContentManager />}
        {activeTab === 'students' && <StudentCreator />}
        {activeTab === 'library' && <TeacherLibraryManager />}
        {activeTab === 'campaign' && <TeacherCampaignManager />}
        {activeTab === 'settings' && <ClassSettingsPanel />}
      </section>
    </main>
  );
}
