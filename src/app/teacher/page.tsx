'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { User, Activity, Book, ChatLog } from '@/types/database';

import StudentTable from '@/components/teacher/StudentTable';
import StudentDetail from '@/components/teacher/StudentDetail';
import ChatHistoryView from '@/components/teacher/ChatHistoryView';
import ContentManager from '@/components/teacher/ContentManager';
import StudentCreator from '@/components/teacher/StudentCreator';
import GalleryGrid from '@/components/teacher/GalleryGrid';
import LoadingSpinner from '@/components/common/LoadingSpinner';

type Tab = 'overview' | 'content' | 'students' | 'gallery';

// Level for the overview tab drill-down
type OverviewLevel = 'list' | 'detail' | 'chat';

interface StudentWithActivity extends User {
  currentActivity?: Activity & { book?: Book };
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

      // Map most recent activity per student.
      const studentActivityMap = new Map<string, Activity & { book?: Book }>();
      for (const act of activities) {
        if (!studentActivityMap.has(act.student_id)) {
          studentActivityMap.set(act.student_id, act);
        }
      }

      const enriched: StudentWithActivity[] = studentList.map((s) => ({
        ...s,
        currentActivity: studentActivityMap.get(s.id),
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
    { key: 'content', label: 'Hidden Stories 관리', icon: '\uD83C\uDF0D' },
    { key: 'students', label: '학생 관리', icon: '\uD83D\uDC65' },
    { key: 'gallery', label: '갤러리', icon: '\uD83D\uDDBC\uFE0F' },
  ];

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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
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
            className={`flex items-center gap-2 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary font-medium'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'content' && <ContentManager />}
        {activeTab === 'students' && <StudentCreator />}
        {activeTab === 'gallery' && <GalleryGrid />}
      </div>
    </main>
  );
}
