'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Class } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function ClassSettingsPanel() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/teacher/classes');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '반 설정을 불러오지 못했습니다');
      }

      setClasses(data.classes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const updateTurns = async (classId: string, nextValue: number) => {
    setSavingId(classId);
    setError('');

    try {
      const res = await fetch('/api/teacher/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: classId, mystory_required_turns: nextValue }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '설정 저장에 실패했습니다');
      }

      setClasses((prev) => prev.map((item) => (
        item.id === classId
          ? { ...item, mystory_required_turns: data.mystory_required_turns }
          : item
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="반 설정을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-bold">반별 이야기 채팅 설정</h3>
        <p className="mt-1 text-sm text-muted">
          각 학급마다 My World에서 처음 검증이 시작되는 학생 채팅 횟수를 다르게 설정할 수 있습니다.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {classes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          설정할 반이 아직 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((item) => (
            <div key={item.id} className="rounded-2xl border border-border bg-white px-5 py-4 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {item.grade}학년 {item.class_name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {item.school} · 반 코드 {item.class_code}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <label htmlFor={`turns-${item.id}`} className="text-sm font-medium text-foreground">
                    검증 시작 횟수
                  </label>
                  <input
                    id={`turns-${item.id}`}
                    type="number"
                    min={3}
                    max={20}
                    value={item.mystory_required_turns}
                    onChange={(event) => {
                      const nextValue = Number(event.target.value);
                      setClasses((prev) => prev.map((row) => (
                        row.id === item.id
                          ? { ...row, mystory_required_turns: Number.isFinite(nextValue) ? nextValue : row.mystory_required_turns }
                          : row
                      )));
                    }}
                    className="w-20 rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={() => updateTurns(item.id, item.mystory_required_turns)}
                    disabled={savingId === item.id}
                    className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-dark disabled:opacity-50"
                  >
                    {savingId === item.id ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
