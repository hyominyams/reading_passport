'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Activity, Book, ChatLog } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface StudentDetailProps {
  student: User;
  onBack: () => void;
  onViewChat: (chatLog: ChatLog) => void;
}

interface ActivityWithBook extends Activity {
  book?: Book;
  chatLogs?: ChatLog[];
}

export default function StudentDetail({ student, onBack, onViewChat }: StudentDetailProps) {
  const [activities, setActivities] = useState<ActivityWithBook[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient();

      // Fetch activities with books
      const { data: actData } = await supabase
        .from('activities')
        .select('*, book:books(*)')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      // Fetch chat logs
      const { data: chatData } = await supabase
        .from('chat_logs')
        .select('*')
        .eq('student_id', student.id)
        .order('created_at', { ascending: false });

      const acts = (actData ?? []) as ActivityWithBook[];
      const chats = (chatData ?? []) as ChatLog[];

      // Group chats by book_id
      const chatsByBook = new Map<string, ChatLog[]>();
      for (const chat of chats) {
        const existing = chatsByBook.get(chat.book_id) ?? [];
        existing.push(chat);
        chatsByBook.set(chat.book_id, existing);
      }

      // Attach chats to activities
      for (const act of acts) {
        act.chatLogs = chatsByBook.get(act.book_id) ?? [];
      }

      setActivities(acts);
      setLoading(false);
    }

    fetchData();
  }, [student.id]);

  const getTabStatus = (activity: ActivityWithBook, tab: string) => {
    if (activity.completed_tabs?.includes(tab)) return 'completed';
    if (tab === 'questions' && activity.chatLogs?.some(cl => cl.chat_type === 'questions')) {
      return 'in_progress';
    }
    return 'not_started';
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="text-success font-medium">\u2705 완료</span>;
      case 'in_progress':
        return <span className="text-secondary font-medium">진행중</span>;
      default:
        return <span className="text-muted">미시작</span>;
    }
  };

  const tabConfig = [
    { key: 'read', icon: '\uD83D\uDCD6', label: 'Story Read' },
    { key: 'hidden', icon: '\uD83C\uDF0D', label: 'Hidden Stories' },
    { key: 'questions', icon: '\u2753', label: '질문 만들기' },
    { key: 'mystory', icon: '\u270F\uFE0F', label: 'My Story' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="학생 활동을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4 transition-colors"
      >
        <span>\u2190</span>
        <span>{student.nickname}의 활동 기록</span>
      </button>

      {activities.length === 0 ? (
        <div className="text-center py-12 text-muted">
          아직 활동 기록이 없습니다
        </div>
      ) : (
        <div className="space-y-6">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="border border-border rounded-xl p-5"
            >
              {/* Book title and stamps */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg">\uD83D\uDCDA</span>
                  <h3 className="font-bold text-foreground">
                    {activity.book?.title ?? '알 수 없는 책'}
                  </h3>
                </div>
                <span className="text-sm font-medium px-3 py-1 bg-muted-light rounded-full">
                  도장 {activity.stamps_earned?.length ?? 0}/4
                </span>
              </div>

              {/* Activity tree */}
              <div className="ml-2 space-y-1">
                {tabConfig.map((tab, idx) => {
                  const status = getTabStatus(activity, tab.key);
                  const isLast = idx === tabConfig.length - 1;

                  return (
                    <div key={tab.key}>
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex items-center gap-1 text-muted text-xs w-4">
                          {!isLast ? '\u251C\u2500\u2500' : '\u2514\u2500\u2500'}
                        </div>
                        <span>{tab.icon}</span>
                        <span className="font-medium text-sm">{tab.label}</span>
                        <span className="ml-auto text-sm">{statusLabel(status)}</span>
                      </div>

                      {/* Show questions log */}
                      {tab.key === 'questions' && activity.chatLogs && activity.chatLogs.length > 0 && (
                        <div className="ml-12 space-y-1 mb-2">
                          {activity.chatLogs
                            .filter((cl) => cl.chat_type === 'questions')
                            .map((chatLog) => {
                              const userMsgs = (chatLog.messages ?? []).filter(m => m.role === 'user');
                              return (
                                <div
                                  key={chatLog.id}
                                  className="flex items-center gap-2 text-sm py-1"
                                >
                                  <span className="text-muted">{'\u2514\u2500'}</span>
                                  <span className="text-muted">질문 {userMsgs.length}개 작성</span>
                                  <button
                                    onClick={() => onViewChat(chatLog)}
                                    className="ml-auto text-xs text-primary hover:text-primary-dark transition-colors"
                                  >
                                    [질문 보기]
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
