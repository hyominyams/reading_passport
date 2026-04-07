'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { countries } from '@/lib/data/countries';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import type { Activity, StampType } from '@/types/database';

const stampLabels: Record<StampType, string> = {
  read: '읽기',
  hidden: '숨은이야기',
  character: '캐릭터',
  mystory: '나만의 이야기',
};

const stampColors: Record<StampType, string> = {
  read: '#3B82F6',
  hidden: '#8B5CF6',
  character: '#F59E0B',
  mystory: '#10B981',
};

const allStampTypes: StampType[] = ['read', 'hidden', 'character', 'mystory'];

interface CountryPassportData {
  countryId: string;
  countryName: string;
  flag: string;
  bookTitle: string | null;
  stamps: StampType[];
  completedAt: string | null;
}

export default function PassportPage() {
  const { user, loading: authLoading } = useAuth();
  const [passportData, setPassportData] = useState<CountryPassportData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPassportData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const supabase = createClient();

      // Fetch all activities for this student
      const { data: activities } = await supabase
        .from('activities')
        .select('*, books:book_id(title, country_id)')
        .eq('student_id', user.id);

      if (activities) {
        const countryMap = new Map<string, CountryPassportData>();

        for (const act of activities as (Activity & { books: { title: string; country_id: string } | null })[]) {
          const countryId = act.country_id;
          const country = countries.find((c) => c.id === countryId);
          const stamps = (act.stamps_earned ?? []) as StampType[];
          const isComplete = allStampTypes.every((s) => stamps.includes(s));

          countryMap.set(countryId, {
            countryId,
            countryName: country?.name ?? countryId,
            flag: country?.flag ?? '',
            bookTitle: act.books?.title ?? null,
            stamps,
            completedAt: isComplete ? act.created_at : null,
          });
        }

        // Include countries with no activities as empty
        for (const c of countries) {
          if (!countryMap.has(c.id)) {
            countryMap.set(c.id, {
              countryId: c.id,
              countryName: c.name,
              flag: c.flag,
              bookTitle: null,
              stamps: [],
              completedAt: null,
            });
          }
        }

        setPassportData(Array.from(countryMap.values()));
      }

      setLoading(false);
    };

    fetchPassportData();
  }, [user]);

  if (authLoading || loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <LoadingSpinner message="여권을 불러오는 중..." />
      </main>
    );
  }

  return (
    <main className="flex-1 px-4 py-6 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-foreground">나의 독서 여권</h1>
        <p className="text-sm text-muted mt-2">
          나라별 독서 활동을 확인하세요
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {passportData.map((data) => {
          const stampCount = data.stamps.length;
          const isComplete = stampCount === 4;

          return (
            <div
              key={data.countryId}
              className={`
                relative p-6 rounded-2xl border-2
                ${isComplete
                  ? 'border-stamp-gold bg-amber-50/50'
                  : 'border-border bg-cream-50'
                }
              `}
              style={{ backgroundColor: isComplete ? undefined : '#FFFBF0' }}
            >
              {/* Country header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{data.flag}</span>
                <div>
                  <h3 className="font-bold text-foreground">{data.countryName}</h3>
                  {data.bookTitle && (
                    <p className="text-xs text-muted">{data.bookTitle}</p>
                  )}
                </div>
                {isComplete && (
                  <span className="ml-auto text-xs font-medium text-stamp-gold bg-stamp-gold/10 px-2 py-1 rounded-full">
                    COMPLETE
                  </span>
                )}
              </div>

              {/* 4 stamp slots */}
              <div className="grid grid-cols-4 gap-3">
                {allStampTypes.map((stampType) => {
                  const earned = data.stamps.includes(stampType);
                  return (
                    <div key={stampType} className="flex flex-col items-center gap-1">
                      <div
                        className={`
                          w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold
                          transition-all duration-300
                          ${earned
                            ? 'shadow-md'
                            : 'border-2 border-dashed border-muted/40'
                          }
                        `}
                        style={
                          earned
                            ? { backgroundColor: stampColors[stampType] + '20', color: stampColors[stampType] }
                            : undefined
                        }
                      >
                        {earned ? (
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <path d="M5 13l4 4L19 7" stroke={stampColors[stampType]} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <span className="text-muted/40 text-xs">?</span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted font-medium">
                        {stampLabels[stampType]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Completion date */}
              {data.completedAt && (
                <p className="text-xs text-muted mt-3 text-right">
                  {new Date(data.completedAt).toLocaleDateString('ko-KR')}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
