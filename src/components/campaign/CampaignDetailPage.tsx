'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import type { Campaign, CampaignAssetMeta, CampaignContentType, SubmissionStatus } from '@/types/database';
import CampaignStatusBadge from './CampaignStatusBadge';
import SubmissionCard from './SubmissionCard';
import SubmissionViewerModal from './SubmissionViewerModal';

interface EnrichedSubmission {
  id: string;
  campaign_id: string;
  student_id: string;
  content_type: CampaignContentType;
  title: string;
  description: string | null;
  assets: CampaignAssetMeta[];
  status: SubmissionStatus;
  created_at: string;
  student?: { id: string; nickname: string | null; avatar: string | null } | null;
  like_count: number;
  liked_by_me: boolean;
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function CampaignDetailPage({ campaignId }: { campaignId: string }) {
  const { role, user } = useAuth();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [submissions, setSubmissions] = useState<EnrichedSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<EnrichedSubmission | null>(null);

  const isTeacher = role === 'teacher' || role === 'admin';
  const isOwner = campaign?.created_by === user?.id || role === 'admin';

  const fetchData = useCallback(async () => {
    try {
      const [campaignRes, submissionsRes] = await Promise.all([
        fetch(`/api/campaign/${campaignId}`),
        fetch(`/api/campaign/${campaignId}/submissions`),
      ]);

      if (campaignRes.ok) {
        const cd = await campaignRes.json();
        setCampaign(cd.campaign);
      }
      if (submissionsRes.ok) {
        const sd = await submissionsRes.json();
        setSubmissions(sd.submissions ?? []);
      }
    } catch (err) {
      console.error('Failed to load campaign detail:', err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleLike = async (submissionId: string) => {
    const res = await fetch(
      `/api/campaign/${campaignId}/submissions/${submissionId}/like`,
      { method: 'POST' }
    );
    if (!res.ok) return;
    const data = await res.json();

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              liked_by_me: data.liked,
              like_count: s.like_count + (data.liked ? 1 : -1),
            }
          : s
      )
    );

    if (selectedSubmission?.id === submissionId) {
      setSelectedSubmission((prev) =>
        prev
          ? {
              ...prev,
              liked_by_me: data.liked,
              like_count: prev.like_count + (data.liked ? 1 : -1),
            }
          : null
      );
    }
  };

  const handleFeature = async (submissionId: string) => {
    const sub = submissions.find((s) => s.id === submissionId);
    if (!sub) return;
    const nextStatus = sub.status === 'featured' ? 'submitted' : 'featured';

    const res = await fetch(
      `/api/campaign/${campaignId}/submissions/${submissionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      }
    );
    if (!res.ok) return;

    setSubmissions((prev) =>
      prev.map((s) => (s.id === submissionId ? { ...s, status: nextStatus } : s))
    );
  };

  const handleStatusChange = async (newStatus: 'active' | 'closed') => {
    const res = await fetch(`/api/campaign/${campaignId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) return;
    setCampaign((prev) => (prev ? { ...prev, status: newStatus } : null));
  };

  if (loading) {
    return (
      <>
        <Header />
        <div className="flex justify-center py-20">
          <LoadingSpinner message="캠페인을 불러오는 중..." />
        </div>
      </>
    );
  }

  if (!campaign) {
    return (
      <>
        <Header />
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-sm text-slate-400">캠페인을 찾을 수 없습니다</p>
          <Link href="/campaign" className="mt-4 text-sm text-slate-600 underline">
            목록으로 돌아가기
          </Link>
        </div>
      </>
    );
  }

  const featuredSubmissions = submissions.filter((s) => s.status === 'featured');
  const otherSubmissions = submissions.filter((s) => s.status !== 'featured');
  const sortedSubmissions = [...featuredSubmissions, ...otherSubmissions];

  const deadlineStr = formatDeadline(campaign.deadline);
  const isActive = campaign.status === 'active';
  const isPastDeadline = campaign.deadline && new Date(campaign.deadline) < new Date();

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Back */}
        <button
          type="button"
          onClick={() => router.push('/campaign')}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          캠페인 목록
        </button>

        {/* Campaign info */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <CampaignStatusBadge status={campaign.status} />
            {deadlineStr && (
              <span className="text-xs text-slate-400">
                마감: {deadlineStr}
                {isPastDeadline && ' (지남)'}
              </span>
            )}
          </div>

          <h1 className="font-heading text-2xl font-bold text-slate-900 sm:text-3xl">
            {campaign.title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500 max-w-2xl">
            {campaign.description}
          </p>

          {campaign.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {campaign.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-0.5 text-xs font-medium text-slate-500"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {/* Student submit CTA */}
            {!isTeacher && isActive && !isPastDeadline && (
              <Link
                href={`/campaign/${campaignId}/submit`}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                나의 작품 제출
              </Link>
            )}

            {/* Teacher controls */}
            {isOwner && campaign.status === 'draft' && (
              <button
                type="button"
                onClick={() => void handleStatusChange('active')}
                className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
              >
                캠페인 공개
              </button>
            )}
            {isOwner && campaign.status === 'active' && (
              <button
                type="button"
                onClick={() => void handleStatusChange('closed')}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                캠페인 마감
              </button>
            )}
          </div>
        </div>

        {/* Submissions */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-slate-900">
            참여 작품 ({submissions.length})
          </h2>
        </div>

        {submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-16 text-center">
            <svg className="mb-3 h-10 w-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6.75v12c0 1.243 1.008 2.25 2.25 2.25z" />
            </svg>
            <p className="text-sm text-slate-400">
              아직 제출된 작품이 없어요
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {sortedSubmissions.map((sub) => (
              <SubmissionCard
                key={sub.id}
                submission={sub}
                onLike={(id) => void handleLike(id)}
                onClick={() => setSelectedSubmission(sub)}
                onFeature={isOwner ? (id) => void handleFeature(id) : undefined}
                isTeacher={isOwner}
              />
            ))}
          </div>
        )}
      </main>

      {/* Viewer modal */}
      {selectedSubmission && (
        <SubmissionViewerModal
          submission={selectedSubmission}
          onClose={() => setSelectedSubmission(null)}
          onLike={(id) => void handleLike(id)}
        />
      )}
    </>
  );
}
