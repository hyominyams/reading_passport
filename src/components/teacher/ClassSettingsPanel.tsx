'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Class } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function ClassSettingsPanel() {
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newClassName, setNewClassName] = useState('');
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

  const updateClassSettings = async (targetClass: Class) => {
    setSavingId(targetClass.id);
    setError('');

    try {
      const res = await fetch('/api/teacher/classes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: targetClass.id,
          mystory_required_turns: targetClass.mystory_required_turns,
          questions_required_count: targetClass.questions_required_count,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '설정 저장에 실패했습니다');
      }

      setClasses((prev) => prev.map((item) => (
        item.id === targetClass.id
          ? {
            ...item,
            mystory_required_turns: data.mystory_required_turns ?? item.mystory_required_turns,
            questions_required_count: data.questions_required_count ?? item.questions_required_count,
          }
          : item
      )));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSavingId(null);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName.trim()) {
      setError('반 이름을 입력해주세요');
      return;
    }

    setCreating(true);
    setError('');

    try {
      const res = await fetch('/api/teacher/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_name: newClassName.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '반 생성에 실패했습니다');
      }

      setClasses((prev) => [...prev, data.class as Class].sort((a, b) => {
        if (a.grade !== b.grade) {
          return a.grade - b.grade;
        }
        return a.class_name.localeCompare(b.class_name);
      }));
      setNewClassName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setCreating(false);
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
        <h3 className="text-base font-bold">반별 운영 설정</h3>
        <p className="mt-1 text-sm text-muted">
          각 학급별로 My World 대화 횟수와 질문 만들기 필수 개수를 따로 관리할 수 있습니다.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex-1">
            <label htmlFor="new-class-name" className="block text-sm font-medium text-foreground mb-2">
              새 반 추가
            </label>
            <input
              id="new-class-name"
              type="text"
              value={newClassName}
              onChange={(event) => setNewClassName(event.target.value)}
              placeholder="예: 2반, 햇살반"
              className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
            />
          </div>
          <button
            onClick={handleCreateClass}
            disabled={creating || !newClassName.trim()}
            className="rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {creating ? '생성 중...' : '반 추가'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
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
              <div className="flex flex-col gap-5">
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {item.grade}학년 {item.class_name}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {item.school} · 반 코드 {item.class_code}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                  <div>
                    <label htmlFor={`turns-${item.id}`} className="mb-2 block text-sm font-medium text-foreground">
                      My World 검증 시작 대화 수
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
                      className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                    />
                  </div>

                  <div>
                    <label htmlFor={`questions-${item.id}`} className="mb-2 block text-sm font-medium text-foreground">
                      질문 만들기 필수 질문 수
                    </label>
                    <input
                      id={`questions-${item.id}`}
                      type="number"
                      min={4}
                      max={11}
                      value={item.questions_required_count}
                      onChange={(event) => {
                        const nextValue = Number(event.target.value);
                        setClasses((prev) => prev.map((row) => (
                          row.id === item.id
                            ? { ...row, questions_required_count: Number.isFinite(nextValue) ? nextValue : row.questions_required_count }
                            : row
                        )));
                      }}
                      className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                    />
                  </div>

                  <button
                    onClick={() => updateClassSettings(item)}
                    disabled={savingId === item.id}
                    className="rounded-xl bg-foreground px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
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
