'use client';

import { useParams } from 'next/navigation';
import CampaignDetailPage from '@/components/campaign/CampaignDetailPage';

export default function CampaignDetailRoute() {
  const params = useParams<{ id: string }>();
  return <CampaignDetailPage campaignId={params.id} />;
}
