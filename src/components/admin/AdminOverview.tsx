'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenText,
  LibraryBig,
  MessageSquareWarning,
  NotebookTabs,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { AdminMetricCard } from '@/components/admin/AdminSurface';
import { adminSectionMap } from '@/components/admin/admin-config';

interface OverviewStats {
  teachers: number;
  students: number;
  pendingApprovals: number;
  books: number;
  hiddenContent: number;
  libraryItems: number;
  flaggedChats: number;
}

interface OverviewResponse {
  stats: OverviewStats;
  recent: {
    teachers: Array<{
      id: string;
      nickname: string | null;
      email: string | null;
      school: string | null;
      created_at: string;
    }>;
    books: Array<{
      id: string;
      title: string;
      country_id: string;
      approved: boolean;
      created_at: string;
    }>;
    approvals: Array<{
      id: string;
      content_type: 'book' | 'hidden_content';
      content_title: string | null;
      status: 'pending' | 'approved' | 'rejected';
      created_at: string;
    }>;
  };
}

const statConfig: Array<{
  key: keyof OverviewStats;
  label: string;
  icon: typeof UsersRound;
  caption: string;
}> = [
  { key: 'teachers', label: '교사', icon: UsersRound, caption: '운영 대상 교사 계정 수' },
  { key: 'students', label: '학생', icon: NotebookTabs, caption: '현재 플랫폼에 연결된 학생 수' },
  { key: 'pendingApprovals', label: '승인 대기', icon: ShieldCheck, caption: '즉시 검토가 필요한 공개 요청' },
  { key: 'books', label: '도서', icon: BookOpenText, caption: '관리 중인 글로벌 그림책 수' },
  { key: 'hiddenContent', label: 'Hidden Stories', icon: LibraryBig, caption: '연결된 확장 콘텐츠 카드 수' },
  { key: 'libraryItems', label: '서재 작품', icon: BookOpenText, caption: '현재 서재에 노출된 학생 작품 수' },
  { key: 'flaggedChats', label: '플래그 대화', icon: MessageSquareWarning, caption: '교사 또는 관리자 점검이 필요한 대화' },
];

export default function AdminOverview() {
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const tone = adminSectionMap.overview.tone;

  useEffect(() => {
    const fetchOverview = async () => {
      setLoading(true);
      setError('');

      try {
        const res = await fetch('/api/admin/overview');
        const next = await res.json();

        if (!res.ok) {
          throw new Error(next.error || '운영 요약을 불러오지 못했습니다');
        }

        setData(next as OverviewResponse);
      } catch (err) {
        setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      } finally {
        setLoading(false);
      }
    };

    void fetchOverview();
  }, []);

  const recentApprovals = useMemo(() => data?.recent.approvals ?? [], [data]);
  const recentTeachers = useMemo(() => data?.recent.teachers ?? [], [data]);
  const recentBooks = useMemo(() => data?.recent.books ?? [], [data]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="운영 현황을 불러오는 중..." />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error || '운영 요약 데이터를 불러오지 못했습니다.'}
      </div>
    );
  }

  const riskLevel = data.stats.flaggedChats > 0 || data.stats.pendingApprovals > 0
    ? '즉시 확인이 필요한 운영 항목이 있습니다.'
    : '현재 즉시 대응이 필요한 운영 리스크는 없습니다.';

  return (
    <div className="space-y-6">
      <section className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-[0_24px_90px_-55px_rgba(15,23,42,0.7)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-100">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />
              <span>운영 상태 브리핑</span>
            </div>
            <h3 className="mt-4 text-xl font-heading font-semibold text-white">
              오늘의 관리자 체크 포인트
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              {riskLevel}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">승인 대기</p>
              <p className="mt-2 text-2xl font-heading font-semibold text-white">
                {data.stats.pendingApprovals}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">플래그 대화</p>
              <p className="mt-2 text-2xl font-heading font-semibold text-white">
                {data.stats.flaggedChats}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statConfig.map((item) => (
          <AdminMetricCard
            key={item.key}
            label={item.label}
            value={data.stats[item.key]}
            caption={item.caption}
            icon={item.icon}
            tone={tone}
          />
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
          <h3 className="text-base font-heading font-semibold text-slate-950">
            최근 교사 등록
          </h3>
          <p className="mt-1 text-sm text-slate-500">새로 생성된 교사 계정 흐름</p>

          <div className="mt-4 space-y-3">
            {recentTeachers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                등록된 교사가 없습니다.
              </div>
            ) : (
              recentTeachers.map((teacher) => (
                <div key={teacher.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">
                        {teacher.nickname || teacher.email || '교사'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {teacher.school || '학교 미등록'}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(teacher.created_at).toLocaleDateString('ko-KR')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
          <h3 className="text-base font-heading font-semibold text-slate-950">
            최근 도서 등록
          </h3>
          <p className="mt-1 text-sm text-slate-500">새로 들어온 글로벌 도서 상태</p>

          <div className="mt-4 space-y-3">
            {recentBooks.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                등록된 도서가 없습니다.
              </div>
            ) : (
              recentBooks.map((book) => (
                <div key={book.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-950">{book.title}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        국가 {book.country_id}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${book.approved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {book.approved ? '승인됨' : '대기'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
          <h3 className="text-base font-heading font-semibold text-slate-950">
            최근 승인 요청
          </h3>
          <p className="mt-1 text-sm text-slate-500">대기 및 처리된 승인 기록</p>

          <div className="mt-4 space-y-3">
            {recentApprovals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">
                승인 요청이 없습니다.
              </div>
            ) : (
              recentApprovals.map((approval) => (
                <div key={approval.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-950">
                        {approval.content_title || '제목 없음'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {approval.content_type === 'book' ? '도서' : 'Hidden Story'} · {new Date(approval.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        approval.status === 'pending'
                          ? 'bg-amber-100 text-amber-800'
                          : approval.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {approval.status === 'pending'
                        ? '대기'
                        : approval.status === 'approved'
                          ? '승인'
                          : '반려'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
