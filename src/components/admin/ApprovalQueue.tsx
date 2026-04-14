'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  BookOpenText,
  Clock3,
  FileText,
  Globe2,
  History,
  ShieldAlert,
} from 'lucide-react';
import type { ApprovalRequest } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BookCoverImage from '@/components/book/BookCoverImage';
import { AdminMetricCard } from '@/components/admin/AdminSurface';
import { adminSectionMap } from '@/components/admin/admin-config';

interface ApprovalWithRelations extends ApprovalRequest {
  requester?: {
    id: string;
    nickname?: string | null;
    email?: string | null;
    school?: string | null;
    grade?: number | null;
    class?: string | null;
  } | null;
  content?: {
    id: string;
    title?: string | null;
    cover_url?: string | null;
    country_id?: string | null;
    scope?: 'global' | 'class' | null;
    approved?: boolean;
    url?: string | null;
    type?: 'video' | 'pdf' | 'image' | 'link';
  } | null;
}

type QueueTab = 'pending' | 'history';
type ApprovalContentFilter = 'all' | 'book' | 'hidden_content';

export default function ApprovalQueue() {
  const [approvals, setApprovals] = useState<ApprovalWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<QueueTab>('pending');
  const [contentFilter, setContentFilter] = useState<ApprovalContentFilter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const tone = adminSectionMap.approvals.tone;

  const fetchApprovals = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/approvals');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '승인 요청을 불러오지 못했습니다');
      }

      const nextApprovals = (data.approvals ?? []) as ApprovalWithRelations[];
      setApprovals(nextApprovals);
      setSelectedId(nextApprovals[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchApprovals();
  }, []);

  const counts = useMemo(() => ({
    pending: approvals.filter((approval) => approval.status === 'pending').length,
    history: approvals.filter((approval) => approval.status !== 'pending').length,
    books: approvals.filter((approval) => approval.content_type === 'book').length,
    hidden: approvals.filter((approval) => approval.content_type === 'hidden_content').length,
  }), [approvals]);

  const filteredApprovals = useMemo(() => (
    approvals.filter((approval) => {
      const matchesTab = tab === 'pending'
        ? approval.status === 'pending'
        : approval.status !== 'pending';
      const matchesType = contentFilter === 'all' || approval.content_type === contentFilter;
      return matchesTab && matchesType;
    })
  ), [approvals, contentFilter, tab]);

  const selectedApproval = useMemo(() => (
    filteredApprovals.find((approval) => approval.id === selectedId)
      ?? filteredApprovals[0]
      ?? null
  ), [filteredApprovals, selectedId]);

  useEffect(() => {
    if (!selectedApproval) {
      setReviewNote('');
      return;
    }

    if (selectedApproval.status === 'pending') {
      setReviewNote('');
      return;
    }

    setReviewNote(selectedApproval.review_note ?? '');
  }, [selectedApproval]);

  const handleAction = async (requestId: string, action: 'approved' | 'rejected') => {
    setProcessing(requestId);
    setError('');

    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId,
          action,
          reviewNote: reviewNote.trim() || null,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '승인 처리에 실패했습니다');
      }

      await fetchApprovals();
      setReviewNote('');
      setTab('pending');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="승인 요청을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="대기 요청"
          value={counts.pending}
          caption="즉시 검토가 필요한 요청"
          icon={Clock3}
          tone={tone}
        />
        <AdminMetricCard
          label="처리 이력"
          value={counts.history}
          caption="승인 또는 반려된 기록"
          icon={History}
          tone={tone}
        />
        <AdminMetricCard
          label="도서 요청"
          value={counts.books}
          caption="도서 전체 공개 요청 비중"
          icon={BookOpenText}
          tone={tone}
        />
        <AdminMetricCard
          label="Hidden 요청"
          value={counts.hidden}
          caption="Hidden Stories 승인 요청 비중"
          icon={Globe2}
          tone={tone}
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-heading font-semibold text-slate-950">승인 워크벤치</h3>
            <p className="mt-1 text-sm text-slate-500">
              대기 요청과 이력을 유형별로 나눠 검토할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex rounded-2xl bg-slate-100 p-1">
              {([
                { key: 'pending', label: '대기' },
                { key: 'history', label: '이력' },
              ] as const).map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setTab(item.key);
                    setSelectedId(null);
                  }}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    tab === item.key
                      ? 'bg-slate-950 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-950'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <select
              value={contentFilter}
              onChange={(event) => {
                setContentFilter(event.target.value as ApprovalContentFilter);
                setSelectedId(null);
              }}
              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
            >
              <option value="all">모든 유형</option>
              <option value="book">도서</option>
              <option value="hidden_content">Hidden Story</option>
            </select>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
          <div className="mb-3 flex items-center justify-between px-2">
            <span className="text-sm font-semibold text-slate-950">
              {tab === 'pending' ? '대기 중인 요청' : '처리된 요청'}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
              {filteredApprovals.length}건
            </span>
          </div>

          <div className="space-y-2">
            {filteredApprovals.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
                표시할 요청이 없습니다.
              </div>
            ) : (
              filteredApprovals.map((approval) => {
                const isSelected = selectedApproval?.id === approval.id;
                return (
                  <button
                    key={approval.id}
                    type="button"
                    onClick={() => setSelectedId(approval.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      isSelected
                        ? 'border-slate-900 bg-slate-950 text-white shadow-sm'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            isSelected
                              ? 'bg-white/10 text-white'
                              : approval.content_type === 'book'
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-cyan-100 text-cyan-700'
                          }`}>
                            {approval.content_type === 'book' ? '도서' : 'Hidden Story'}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                            approval.status === 'pending'
                              ? 'bg-amber-100 text-amber-800'
                              : approval.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                          }`}>
                            {approval.status === 'pending'
                              ? '대기'
                              : approval.status === 'approved'
                                ? '승인'
                                : '반려'}
                          </span>
                        </div>
                        <p className={`mt-3 text-sm font-semibold ${isSelected ? 'text-white' : 'text-slate-950'}`}>
                          {approval.content_title || approval.content?.title || '제목 없음'}
                        </p>
                        <p className={`mt-1 text-xs ${isSelected ? 'text-white/75' : 'text-slate-500'}`}>
                          {approval.requester?.nickname || approval.requester?.email || '요청자 미상'}
                        </p>
                      </div>
                      <ArrowApprovalIcon type={approval.content_type} selected={isSelected} />
                    </div>
                    <p className={`mt-2 text-xs ${isSelected ? 'text-white/72' : 'text-slate-500'}`}>
                      {new Date(approval.created_at).toLocaleDateString('ko-KR')}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
          {!selectedApproval ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-500">
              왼쪽에서 승인 요청을 선택하세요.
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      selectedApproval.content_type === 'book'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-cyan-100 text-cyan-700'
                    }`}>
                      {selectedApproval.content_type === 'book' ? '도서 공개 요청' : 'Hidden Story 공개 요청'}
                    </span>
                    <span className="text-xs text-slate-500">
                      {new Date(selectedApproval.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <h4 className="mt-3 text-2xl font-heading font-semibold text-slate-950">
                    {selectedApproval.content_title || selectedApproval.content?.title || '제목 없음'}
                  </h4>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Scope
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-950">
                    {selectedApproval.content?.scope || selectedApproval.content_scope || '-'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[0.95fr_1.05fr]">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">요청자</p>
                  <p className="mt-3 font-medium text-slate-950">
                    {selectedApproval.requester?.nickname || selectedApproval.requester?.email || '알 수 없음'}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedApproval.requester?.email || '이메일 없음'}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {selectedApproval.requester?.school || '학교 미등록'}
                    {selectedApproval.requester?.grade ? ` · ${selectedApproval.requester.grade}학년` : ''}
                    {selectedApproval.requester?.class ? ` · ${selectedApproval.requester.class}` : ''}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">대상 콘텐츠</p>
                  {selectedApproval.content_type === 'book' ? (
                    <div className="mt-3 flex gap-4">
                      <div className="relative h-24 w-[72px] overflow-hidden rounded-xl bg-white shadow-sm">
                        <BookCoverImage
                          title={selectedApproval.content?.title || '도서'}
                          coverUrl={selectedApproval.content?.cover_url || null}
                          sizes="72px"
                          fallbackClassName="flex h-full w-full items-center justify-center bg-slate-100"
                          iconClassName="h-5 w-5 text-slate-400"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-950">
                          {selectedApproval.content?.title || selectedApproval.content_title || '제목 없음'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          국가: {selectedApproval.content?.country_id || '-'}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          범위: {selectedApproval.content?.scope || selectedApproval.content_scope || '-'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 space-y-2">
                      <p className="font-medium text-slate-950">
                        {selectedApproval.content?.title || selectedApproval.content_title || '제목 없음'}
                      </p>
                      <p className="text-sm text-slate-500">
                        유형: {selectedApproval.content?.type || '-'}
                      </p>
                      <a
                        href={selectedApproval.content?.url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-700 underline-offset-2 hover:underline"
                      >
                        <FileText className="h-4 w-4" />
                        <span>원본 링크 열기</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {selectedApproval.status === 'pending' ? (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900">
                          검토 메모를 남기면 이후 승인 이력 추적이 쉬워집니다.
                        </p>
                        <p className="mt-1 text-sm text-amber-800/85">
                          반려 사유나 승인 판단 기준을 간단히 남겨두세요.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-950">
                      검토 메모
                    </label>
                    <textarea
                      value={reviewNote}
                      onChange={(event) => setReviewNote(event.target.value)}
                      rows={4}
                      placeholder="승인 또는 반려 사유를 기록해두면 이후 이력 확인에 도움이 됩니다."
                      className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={processing === selectedApproval.id}
                      onClick={() => void handleAction(selectedApproval.id, 'approved')}
                      className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {processing === selectedApproval.id ? '처리 중...' : '승인'}
                    </button>
                    <button
                      type="button"
                      disabled={processing === selectedApproval.id}
                      onClick={() => void handleAction(selectedApproval.id, 'rejected')}
                      className="rounded-2xl bg-rose-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                    >
                      {processing === selectedApproval.id ? '처리 중...' : '반려'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                  <p className="text-sm font-medium text-slate-950">처리 메모</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {selectedApproval.review_note || '기록된 메모가 없습니다.'}
                  </p>
                  <p className="mt-3 text-xs text-slate-500">
                    처리일 {selectedApproval.reviewed_at
                      ? new Date(selectedApproval.reviewed_at).toLocaleString('ko-KR')
                      : '-'}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ArrowApprovalIcon({
  type,
  selected,
}: {
  type: ApprovalWithRelations['content_type'];
  selected: boolean;
}) {
  if (type === 'book') {
    return <BookOpenText className={`h-5 w-5 ${selected ? 'text-white/80' : 'text-indigo-500'}`} />;
  }

  return <Globe2 className={`h-5 w-5 ${selected ? 'text-white/80' : 'text-cyan-500'}`} />;
}
