'use client';

import { useState, useEffect } from 'react';
import type { ApprovalRequest, User } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface ApprovalWithRequester extends ApprovalRequest {
  requester?: User;
}

export default function ApprovalQueue() {
  const [approvals, setApprovals] = useState<ApprovalWithRequester[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchApprovals();
  }, []);

  async function fetchApprovals() {
    const res = await fetch('/api/admin/approvals');
    const data = await res.json();
    setApprovals(data.approvals ?? []);
    setLoading(false);
  }

  async function handleAction(requestId: string, action: 'approved' | 'rejected') {
    setProcessing(requestId);
    try {
      const res = await fetch('/api/admin/approvals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });

      if (res.ok) {
        setApprovals((prev) => prev.filter((a) => a.id !== requestId));
      }
    } finally {
      setProcessing(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="승인 요청을 불러오는 중..." />
      </div>
    );
  }

  if (approvals.length === 0) {
    return (
      <div className="text-center py-12 text-muted">
        대기 중인 승인 요청이 없습니다
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted">
          대기 중: {approvals.length}건
        </span>
      </div>

      {approvals.map((approval) => (
        <div
          key={approval.id}
          className="border border-border rounded-xl p-5 hover:bg-card-hover transition-colors"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 text-xs rounded-full bg-secondary/10 text-secondary-dark font-medium">
                  {approval.content_type === 'book' ? '도서' : 'Hidden Content'}
                </span>
                <span className="text-xs text-muted">
                  {new Date(approval.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>

              <p className="text-sm font-medium mb-1">
                요청자: {approval.requester?.nickname ?? approval.requester?.email ?? '알 수 없음'}
              </p>
              <p className="text-xs text-muted">
                {approval.requester?.school && `${approval.requester.school} `}
                {approval.requester?.grade && `${approval.requester.grade}학년 `}
                {approval.requester?.class && `${approval.requester.class}반`}
              </p>
              <p className="text-xs text-muted mt-1">
                콘텐츠 ID: {approval.content_id}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleAction(approval.id, 'approved')}
                disabled={processing === approval.id}
                className="px-4 py-2 text-sm bg-success text-white rounded-lg hover:bg-accent-dark transition-colors disabled:opacity-50"
              >
                {processing === approval.id ? '...' : '승인'}
              </button>
              <button
                onClick={() => handleAction(approval.id, 'rejected')}
                disabled={processing === approval.id}
                className="px-4 py-2 text-sm bg-error text-white rounded-lg hover:bg-error/90 transition-colors disabled:opacity-50"
              >
                {processing === approval.id ? '...' : '반려'}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
