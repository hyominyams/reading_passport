'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Globe2,
  Languages,
  Lightbulb,
  Rows3,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { countries } from '@/lib/data/countries';
import { AdminMetricCard } from '@/components/admin/AdminSurface';
import { adminSectionMap } from '@/components/admin/admin-config';

interface CountryFact {
  id: string;
  country_id: string;
  fact_text: string;
  fact_text_en: string | null;
  order: number;
}

const emptyFact = {
  id: '',
  country_id: '',
  fact_text: '',
  fact_text_en: '',
  order: '0',
};

export default function FactsManager() {
  const [facts, setFacts] = useState<CountryFact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countryFilter, setCountryFilter] = useState('all');
  const [editing, setEditing] = useState<{
    id: string;
    country_id: string;
    fact_text: string;
    fact_text_en: string;
    order: string;
  }>(emptyFact);
  const [saving, setSaving] = useState(false);
  const tone = adminSectionMap.facts.tone;

  const fetchFacts = async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/facts');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '상식 데이터를 불러오지 못했습니다');
      }

      setFacts((data.facts ?? []) as CountryFact[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchFacts();
  }, []);

  const filteredFacts = useMemo(() => (
    countryFilter === 'all'
      ? facts
      : facts.filter((fact) => fact.country_id === countryFilter)
  ), [countryFilter, facts]);

  const counts = useMemo(() => ({
    total: facts.length,
    countries: new Set(facts.map((fact) => fact.country_id)).size,
    bilingual: facts.filter((fact) => !!fact.fact_text_en).length,
    filtered: filteredFacts.length,
  }), [facts, filteredFacts]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    if (!editing.country_id || !editing.fact_text.trim()) {
      setSaving(false);
      setError('국가와 한글 문구는 필수입니다.');
      return;
    }

    try {
      const payload = {
        id: editing.id || undefined,
        country_id: editing.country_id,
        fact_text: editing.fact_text.trim(),
        fact_text_en: editing.fact_text_en.trim(),
        order: Number(editing.order) || 0,
      };

      const res = await fetch('/api/admin/facts', {
        method: editing.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '상식 저장에 실패했습니다');
      }

      setEditing(emptyFact);
      await fetchFacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('이 상식 문구를 삭제하시겠습니까?');
    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/facts?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '삭제에 실패했습니다');
      }
      setFacts((prev) => prev.filter((fact) => fact.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="세계 상식 데이터를 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label="전체 문구"
          value={counts.total}
          caption="저장된 country facts 수"
          icon={Lightbulb}
          tone={tone}
        />
        <AdminMetricCard
          label="국가 커버"
          value={counts.countries}
          caption="문구가 연결된 국가 수"
          icon={Globe2}
          tone={tone}
        />
        <AdminMetricCard
          label="영문 포함"
          value={counts.bilingual}
          caption="한/영 문구가 모두 있는 facts"
          icon={Languages}
          tone={tone}
        />
        <AdminMetricCard
          label="현재 필터"
          value={counts.filtered}
          caption="선택된 국가 조건에서 보이는 항목"
          icon={Rows3}
          tone={tone}
        />
      </section>

      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-heading font-semibold text-slate-950">Country Facts 관리</h3>
            <p className="mt-1 text-sm text-slate-500">
              My World 제작 대기 화면에 노출되는 나라별 상식 문구를 유지합니다.
            </p>
          </div>

          <select
            value={countryFilter}
            onChange={(event) => setCountryFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
          >
            <option value="all">모든 국가</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </select>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
          <h4 className="text-base font-heading font-semibold text-slate-950">
            {editing.id ? '상식 수정' : '새 상식 추가'}
          </h4>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900">국가</label>
              <select
                value={editing.country_id}
                onChange={(event) => setEditing((prev) => ({ ...prev, country_id: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
              >
                <option value="">국가를 선택하세요</option>
                {countries.map((country) => (
                  <option key={country.id} value={country.id}>
                    {country.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900">한글 문구</label>
              <textarea
                value={editing.fact_text}
                onChange={(event) => setEditing((prev) => ({ ...prev, fact_text: event.target.value }))}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900">영문 문구</label>
              <textarea
                value={editing.fact_text_en}
                onChange={(event) => setEditing((prev) => ({ ...prev, fact_text_en: event.target.value }))}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-900">순서</label>
              <input
                type="number"
                min={0}
                value={editing.order}
                onChange={(event) => setEditing((prev) => ({ ...prev, order: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-lime-200"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditing(emptyFact)}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                초기화
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? '저장 중...' : editing.id ? '수정' : '등록'}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_-52px_rgba(15,23,42,0.3)]">
          <h4 className="text-base font-heading font-semibold text-slate-950">등록된 상식</h4>
          <div className="mt-4 space-y-3">
            {filteredFacts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-500">
                표시할 상식 문구가 없습니다.
              </div>
            ) : (
              filteredFacts.map((fact) => {
                const country = countries.find((item) => item.id === fact.country_id);
                return (
                  <article key={fact.id} className="rounded-[24px] border border-slate-200 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                            {country?.flag} {country?.name || fact.country_id}
                          </span>
                          <span className="rounded-full bg-lime-50 px-2.5 py-1 text-[11px] font-semibold text-lime-700">
                            순서 {fact.order}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-slate-950">{fact.fact_text}</p>
                        {fact.fact_text_en ? (
                          <p className="mt-2 text-sm leading-6 text-slate-500">{fact.fact_text_en}</p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setEditing({
                            id: fact.id,
                            country_id: fact.country_id,
                            fact_text: fact.fact_text,
                            fact_text_en: fact.fact_text_en ?? '',
                            order: String(fact.order),
                          })}
                          className="rounded-2xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(fact.id)}
                          className="rounded-2xl border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
