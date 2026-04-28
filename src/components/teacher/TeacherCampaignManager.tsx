'use client';

import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  getEffectiveCampaignStatus,
  isCampaignPastDeadline,
  normalizeCampaignDeadlineInput,
} from '@/lib/campaign-deadline';
import type { Campaign, CampaignContentType, CampaignStatus, ContentScope } from '@/types/database';

// ── Types ──

interface EnrichedSubmission {
  id: string;
  campaign_id: string;
  student_id: string;
  content_type: CampaignContentType;
  title: string;
  description: string | null;
  assets: Array<{ id: string; name: string; type: string; public_url: string }>;
  status: string;
  created_at: string;
  like_count: number;
  liked_by_me: boolean;
  student?: { nickname?: string | null } | null;
}

type View = 'list' | 'detail' | 'create';

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: '임시 저장',
  active: '진행 중',
  closed: '마감',
};

const STATUS_STYLE: Record<CampaignStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-red-100 text-red-600',
};

const CONTENT_TYPE_LABELS: { key: CampaignContentType; label: string }[] = [
  { key: 'poster', label: '포스터' },
  { key: 'card_news', label: '카드뉴스' },
  { key: 'impression', label: '감상문' },
  { key: 'culture_intro', label: '문화 소개' },
  { key: 'worksheet', label: '활동지' },
  { key: 'other', label: '기타' },
];

// ── Component ──

export default function TeacherCampaignManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('list');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<EnrichedSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Create form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTypes, setFormTypes] = useState<CampaignContentType[]>(['other']);
  const [formTags, setFormTags] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formMaxFiles, setFormMaxFiles] = useState(3);
  const [formMaxSize, setFormMaxSize] = useState(5);
  const [formScope, setFormScope] = useState<ContentScope>('class');
  const [formSaving, setFormSaving] = useState(false);

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId],
  );

  // ── Fetch campaigns ──

  const fetchCampaigns = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/campaign');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '캠페인을 불러오지 못했습니다');
      setCampaigns(data.campaigns ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  // ── Fetch submissions for detail view ──

  const fetchSubmissions = async (campaignId: string) => {
    setSubmissionsLoading(true);
    try {
      const res = await fetch(`/api/campaign/${campaignId}/submissions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '제출물을 불러오지 못했습니다');
      setSubmissions(data.submissions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const openDetail = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setView('detail');
    fetchSubmissions(campaignId);
  };

  // ── Status change ──

  const updateStatus = async (campaignId: string, status: CampaignStatus) => {
    setUpdating(true);
    setError('');
    try {
      const res = await fetch(`/api/campaign/${campaignId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '상태 변경에 실패했습니다');
      }
      setCampaigns((prev) =>
        prev.map((c) => (c.id === campaignId ? { ...c, status } : c)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setUpdating(false);
    }
  };

  // ── Delete campaign ──

  const deleteCampaign = async (campaignId: string) => {
    if (!window.confirm('이 캠페인을 삭제하시겠습니까?')) return;
    setUpdating(true);
    setError('');
    try {
      const res = await fetch(`/api/campaign/${campaignId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '삭제에 실패했습니다');
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== campaignId));
      if (selectedCampaignId === campaignId) {
        setView('list');
        setSelectedCampaignId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setUpdating(false);
    }
  };

  // ── Create campaign ──

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormTypes(['other']);
    setFormTags('');
    setFormDeadline('');
    setFormMaxFiles(3);
    setFormMaxSize(5);
    setFormScope('class');
  };

  const handleCreate = async (status: CampaignStatus) => {
    if (!formTitle.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!formDescription.trim()) { setError('설명을 입력해주세요.'); return; }
    if (formTypes.length === 0) { setError('콘텐츠 유형을 최소 1개 선택해주세요.'); return; }

    setFormSaving(true);
    setError('');
    try {
      const res = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDescription.trim(),
          allowed_content_types: formTypes,
          tags: formTags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 5),
          deadline: normalizeCampaignDeadlineInput(formDeadline),
          max_files_per_submission: formMaxFiles,
          max_file_size_mb: formMaxSize,
          scope: formScope,
          status,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '캠페인 생성에 실패했습니다');
      }
      resetForm();
      setView('list');
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setFormSaving(false);
    }
  };

  const toggleType = (key: CampaignContentType) => {
    setFormTypes((prev) =>
      prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key],
    );
  };

  // ── Loading ──

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="캠페인을 불러오는 중..." />
      </div>
    );
  }

  // ── Error banner ──

  const errorBanner = error ? (
    <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {error}
    </div>
  ) : null;

  // ── CREATE VIEW ──

  if (view === 'create') {
    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <button
            onClick={() => { setView('list'); setError(''); }}
            className="mb-4 text-sm text-muted hover:text-foreground"
          >
            &larr; 캠페인 목록으로
          </button>

          <h3 className="text-base font-bold text-foreground">새 캠페인 만들기</h3>
          <p className="mt-1 text-sm text-muted">캠페인을 만들어 학생들의 참여를 이끌어보세요.</p>

          {errorBanner}

          <div className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">제목</label>
              <input
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="캠페인 제목"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">설명</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                placeholder="캠페인 설명"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">허용 콘텐츠 유형</label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_TYPE_LABELS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleType(key)}
                    className={`rounded-xl border px-3 py-2 text-xs transition-colors ${
                      formTypes.includes(key)
                        ? 'border-foreground bg-foreground/5 text-foreground font-medium'
                        : 'border-border hover:bg-muted-light'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">범위</label>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as ContentScope)}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                >
                  <option value="class">우리 반</option>
                  <option value="global">전체 공개</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">마감일</label>
                <input
                  type="date"
                  value={formDeadline}
                  onChange={(e) => setFormDeadline(e.target.value)}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">최대 파일 수</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formMaxFiles}
                  onChange={(e) => setFormMaxFiles(Number(e.target.value))}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">최대 파일 크기 (MB)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={formMaxSize}
                  onChange={(e) => setFormMaxSize(Number(e.target.value))}
                  className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">태그 (쉼표 구분, 최대 5개)</label>
              <input
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
                placeholder="예: 포스터, 세계문화, 독서"
                className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleCreate('draft')}
                disabled={formSaving}
                className="flex-1 rounded-xl border border-border px-4 py-3 text-sm font-medium hover:bg-muted-light disabled:opacity-50"
              >
                {formSaving ? '저장 중...' : '임시 저장'}
              </button>
              <button
                onClick={() => handleCreate('active')}
                disabled={formSaving}
                className="flex-1 rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-white hover:bg-foreground/90 disabled:opacity-50"
              >
                {formSaving ? '저장 중...' : '바로 공개'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── DETAIL VIEW ──

  if (view === 'detail' && selectedCampaign) {
    const effectiveStatus = getEffectiveCampaignStatus(selectedCampaign);
    const isExpired = isCampaignPastDeadline(selectedCampaign.deadline);

    return (
      <div className="space-y-6">
        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <button
            onClick={() => { setView('list'); setSelectedCampaignId(null); setError(''); }}
            className="mb-4 text-sm text-muted hover:text-foreground"
          >
            &larr; 캠페인 목록으로
          </button>

          {errorBanner}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-foreground">{selectedCampaign.title}</h3>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[effectiveStatus]}`}>
                  {STATUS_LABEL[effectiveStatus]}
                </span>
              </div>
              <p className="mt-2 text-sm text-muted">{selectedCampaign.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                {selectedCampaign.deadline && (
                  <span>마감: {new Date(selectedCampaign.deadline).toLocaleDateString('ko-KR')}{isExpired ? ' (마감됨)' : ''}</span>
                )}
                <span>범위: {selectedCampaign.scope === 'class' ? '우리 반' : '전체'}</span>
                <span>제출 {submissions.length}건</span>
              </div>
              {selectedCampaign.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {selectedCampaign.tags.map((tag) => (
                    <span key={tag} className="rounded-full bg-muted-light px-2 py-0.5 text-[11px] text-muted">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              {selectedCampaign.status === 'draft' && (
                <button
                  onClick={() => updateStatus(selectedCampaign.id, 'active')}
                  disabled={updating}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  공개하기
                </button>
              )}
              {selectedCampaign.status === 'active' && (
                <button
                  onClick={() => updateStatus(selectedCampaign.id, 'closed')}
                  disabled={updating}
                  className="rounded-xl border border-red-200 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  마감하기
                </button>
              )}
              <button
                onClick={() => deleteCampaign(selectedCampaign.id)}
                disabled={updating}
                className="rounded-xl border border-border px-4 py-2 text-xs text-muted hover:bg-muted-light disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        </div>

        {/* Submissions */}
        <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
          <h4 className="text-base font-bold text-foreground">
            학생 제출물 ({submissions.length})
          </h4>

          {submissionsLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner message="제출물을 불러오는 중..." />
            </div>
          ) : submissions.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
              아직 제출된 작품이 없습니다.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {submissions.map((sub) => (
                <div key={sub.id} className="rounded-2xl border border-border p-4">
                  {sub.assets[0]?.type === 'image' && (
                    <div className="mb-3 aspect-[4/3] overflow-hidden rounded-xl bg-muted-light">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sub.assets[0].public_url}
                        alt={sub.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <h5 className="truncate text-sm font-semibold text-foreground">{sub.title}</h5>
                  <p className="mt-1 text-xs text-muted">
                    {sub.student?.nickname ?? '학생'} · {new Date(sub.created_at).toLocaleDateString('ko-KR')}
                  </p>
                  <div className="mt-2 flex items-center gap-3 text-xs text-muted">
                    <span>
                      {CONTENT_TYPE_LABELS.find((ct) => ct.key === sub.content_type)?.label ?? sub.content_type}
                    </span>
                    <span>
                      {sub.like_count > 0 ? `${sub.like_count} likes` : ''}
                    </span>
                    {sub.status === 'featured' && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                        Featured
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LIST VIEW (default) ──

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-base font-bold text-foreground">캠페인 관리</h3>
            <p className="mt-1 text-sm text-muted">
              캠페인을 생성하고 학생 참여를 관리합니다.
            </p>
          </div>
          <button
            onClick={() => { setView('create'); setError(''); resetForm(); }}
            className="shrink-0 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-white hover:bg-foreground/90"
          >
            새 캠페인 만들기
          </button>
        </div>

        {errorBanner}

        {campaigns.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            아직 등록된 캠페인이 없습니다. 새 캠페인을 만들어보세요.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {campaigns.map((campaign) => {
              const effectiveStatus = getEffectiveCampaignStatus(campaign);

              return (
                <article
                  key={campaign.id}
                  onClick={() => openDetail(campaign.id)}
                  className="cursor-pointer rounded-2xl border border-border p-5 transition-colors hover:bg-muted-light/50"
                >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="truncate text-sm font-semibold text-foreground">
                        {campaign.title}
                      </h4>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[effectiveStatus]}`}>
                        {STATUS_LABEL[effectiveStatus]}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {campaign.description}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                  {campaign.deadline && (
                    <span>마감: {new Date(campaign.deadline).toLocaleDateString('ko-KR')}</span>
                  )}
                  <span>{campaign.scope === 'class' ? '우리 반' : '전체'}</span>
                  <span>
                    {campaign.allowed_content_types.map((t) =>
                      CONTENT_TYPE_LABELS.find((ct) => ct.key === t)?.label ?? t
                    ).join(', ')}
                  </span>
                </div>

                {campaign.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {campaign.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-muted-light px-2 py-0.5 text-[11px] text-muted">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
