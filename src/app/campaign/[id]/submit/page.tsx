'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import SubmissionForm from '@/components/campaign/SubmissionForm';
import type { Campaign } from '@/types/database';

export default function CampaignSubmitPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/campaign/${params.id}`);
        if (!res.ok) {
          router.replace('/campaign');
          return;
        }
        const data = await res.json();
        if (data.campaign.status !== 'active') {
          router.replace(`/campaign/${params.id}`);
          return;
        }
        setCampaign(data.campaign);
      } catch {
        router.replace('/campaign');
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [params.id, router]);

  if (loading || !campaign) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner message="캠페인을 불러오는 중..." />
      </div>
    );
  }

  return <SubmissionForm campaign={campaign} />;
}
