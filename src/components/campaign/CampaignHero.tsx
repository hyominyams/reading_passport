'use client';

import Link from 'next/link';
import type { Campaign } from '@/types/database';

export default function CampaignHero({ campaign }: { campaign: Campaign }) {
  return (
    <section className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {campaign.cover_image_url && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={campaign.cover_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-transparent" />
        </>
      )}

      <div className="relative flex flex-col justify-end p-8 sm:p-10 md:p-14 min-h-[280px] sm:min-h-[340px]">
        <p className="mb-4 text-[11px] font-heading font-medium uppercase tracking-[0.35em] text-white/40">
          Featured Campaign
        </p>
        <h2 className="max-w-xl font-heading text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl">
          {campaign.title}
        </h2>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">
          {campaign.description.slice(0, 120)}
          {campaign.description.length > 120 ? '...' : ''}
        </p>

        <div className="mt-6">
          <Link
            href={`/campaign/${campaign.id}`}
            className="group inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-7 py-2.5 text-sm font-medium tracking-wide text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white/20"
          >
            자세히 보기
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
