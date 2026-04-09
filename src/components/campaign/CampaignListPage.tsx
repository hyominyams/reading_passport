'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import type { Campaign, CampaignContentType } from '@/types/database';
import { SAMPLE_CAMPAIGNS } from '@/lib/data/dummyCampaign';
import CampaignCard from './CampaignCard';
import CampaignHero from './CampaignHero';

type FilterKey = 'all' | CampaignContentType;

const filterOptions: { key: FilterKey; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'poster', label: '포스터' },
  { key: 'card_news', label: '카드뉴스' },
  { key: 'impression', label: '감상문' },
  { key: 'culture_intro', label: '문화 소개' },
  { key: 'worksheet', label: '활동지' },
  { key: 'other', label: '기타' },
];

export default function CampaignListPage() {
  const { isAuthenticated, role } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('all');

  const fetchCampaigns = useCallback(async () => {
    try {
      const res = await fetch('/api/campaign');
      if (res.ok) {
        const data = await res.json();
        const items = data.campaigns ?? [];
        // Use sample data as fallback if DB has no campaigns yet
        setCampaigns(items.length > 0 ? items : SAMPLE_CAMPAIGNS);
      } else {
        setCampaigns(SAMPLE_CAMPAIGNS);
      }
    } catch (err) {
      console.error('Failed to fetch campaigns:', err);
      setCampaigns(SAMPLE_CAMPAIGNS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchCampaigns();
    }
  }, [isAuthenticated, fetchCampaigns]);

  const filteredCampaigns = useMemo(() => {
    if (selectedFilter === 'all') return campaigns;
    return campaigns.filter((c) =>
      c.allowed_content_types.includes(selectedFilter as CampaignContentType)
    );
  }, [campaigns, selectedFilter]);

  const featuredCampaign = campaigns.find((c) => c.status === 'active') ?? campaigns[0];
  const isTeacher = role === 'teacher' || role === 'admin';

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-heading font-medium uppercase tracking-[0.35em] text-slate-400">
              Campaign Board
            </p>
            <h1 className="mt-2 font-heading text-2xl font-bold text-slate-900 sm:text-3xl">
              캠페인 보드
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              교사가 기획한 캠페인에 참여하고 창작물을 공유하세요
            </p>
          </div>

          {isTeacher && (
            <Link
              href="/campaign/create"
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              캠페인 만들기
            </Link>
          )}
        </div>

        {/* Hero */}
        {featuredCampaign && !loading && (
          <div className="mb-10">
            <CampaignHero campaign={featuredCampaign} />
          </div>
        )}

        {/* Filter pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSelectedFilter(opt.key)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium transition ${
                selectedFilter === opt.key
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Campaign grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner message="캠페인을 불러오는 중..." />
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 py-20 text-center">
            <svg
              className="mb-4 h-10 w-10 text-slate-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12H9.75m0 0l2.25 2.25M9.75 14.25l2.25-2.25M6 20.25h12A2.25 2.25 0 0020.25 18V6.75A2.25 2.25 0 0018 4.5H6A2.25 2.25 0 003.75 6.75v11.25c0 1.242 1.008 2.25 2.25 2.25z"
              />
            </svg>
            <p className="text-sm text-slate-400">
              {selectedFilter === 'all'
                ? '아직 등록된 캠페인이 없어요'
                : '해당 유형의 캠페인이 없어요'}
            </p>
            {isTeacher && (
              <Link
                href="/campaign/create"
                className="mt-4 text-sm font-medium text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                첫 캠페인을 만들어보세요
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCampaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
