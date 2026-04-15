'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Class, User } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const MAX_STUDENTS = 30;
const DEFAULT_COUNT = 5;

interface EditableStudent {
  nickname: string;
  className: string;
}

interface CreatedStudent {
  number: number;
  nickname: string;
  code: string;
}

export default function StudentCreator() {
  const [students, setStudents] = useState<User[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentCount, setStudentCount] = useState(DEFAULT_COUNT);
  const [entries, setEntries] = useState<string[]>(Array(DEFAULT_COUNT).fill(''));
  const [selectedClassName, setSelectedClassName] = useState('기본반');
  const [creating, setCreating] = useState(false);
  const [createdStudents, setCreatedStudents] = useState<CreatedStudent[] | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditableStudent | null>(null);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const nicknameRefs = useRef<(HTMLInputElement | null)[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      const [studentsRes, classesRes] = await Promise.all([
        fetch('/api/teacher/students'),
        fetch('/api/teacher/classes'),
      ]);

      const studentsData = await studentsRes.json();
      const classesData = await classesRes.json();

      if (!studentsRes.ok) {
        throw new Error(studentsData.error || '학생 정보를 불러오지 못했습니다');
      }

      if (!classesRes.ok) {
        throw new Error(classesData.error || '반 정보를 불러오지 못했습니다');
      }

      const nextClasses = (classesData.classes ?? []) as Class[];
      const nextStudents = (studentsData.students ?? []) as User[];

      setStudents(nextStudents);
      setClasses(nextClasses);

      const defaultClassName = nextClasses[0]?.class_name ?? '기본반';
      setSelectedClassName((prev) => prev || defaultClassName);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCountChange = (newCount: number) => {
    const clamped = Math.max(1, Math.min(MAX_STUDENTS, newCount));
    setStudentCount(clamped);
    setEntries((prev) => {
      if (clamped > prev.length) {
        return [...prev, ...Array(clamped - prev.length).fill('')];
      }
      return prev.slice(0, clamped);
    });
  };

  const updateEntry = (index: number, value: string) => {
    setEntries((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const handleEntryKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (index < studentCount - 1) {
        nicknameRefs.current[index + 1]?.focus();
      }
    }
  };

  const filledCount = entries.filter((e) => e.trim().length > 0).length;

  const handleBulkCreate = async () => {
    setError('');
    const validEntries = entries
      .map((nickname, idx) => ({ number: idx + 1, nickname: nickname.trim() }))
      .filter((e) => e.nickname.length > 0);

    if (validEntries.length === 0) {
      setError('닉네임을 하나 이상 입력해주세요');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/teacher/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'bulk_create',
          nicknames: validEntries.map((e) => e.nickname),
          className: selectedClassName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '학생 생성에 실패했습니다');
      }

      const enriched: CreatedStudent[] = (
        data.students as { nickname: string; code: string }[]
      ).map((s, i) => ({
        number: validEntries[i].number,
        ...s,
      }));

      setCreatedStudents(enriched);
      setEntries(Array(studentCount).fill(''));
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setCreating(false);
    }
  };

  const handleResetCode = async (studentId: string) => {
    try {
      const res = await fetch('/api/teacher/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_code', studentId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '코드 재발급에 실패했습니다');
      }

      setResetConfirm(null);
      await fetchData();
      setRevealedCodes((prev) => new Set(prev).add(studentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  const handleDeleteStudent = async (studentId: string) => {
    setSavingStudentId(studentId);
    setError('');

    try {
      const res = await fetch(`/api/teacher/students?studentId=${studentId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '학생 삭제에 실패했습니다');
      }

      setDeleteConfirm(null);
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSavingStudentId(null);
    }
  };

  const startEdit = (student: User) => {
    setEditingStudentId(student.id);
    setEditDraft({
      nickname: student.nickname ?? '',
      className: student.class ?? selectedClassName,
    });
  };

  const cancelEdit = () => {
    setEditingStudentId(null);
    setEditDraft(null);
  };

  const saveStudent = async (studentId: string) => {
    if (!editDraft) {
      return;
    }

    setSavingStudentId(studentId);
    setError('');

    try {
      const res = await fetch('/api/teacher/students', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId,
          nickname: editDraft.nickname,
          className: editDraft.className,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '학생 정보 저장에 실패했습니다');
      }

      cancelEdit();
      await fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setSavingStudentId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyAllCodes = () => {
    if (!createdStudents) return;
    const text = createdStudents
      .map((s) => `${s.number}번 ${s.nickname}: ${s.code}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="학생 목록을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-base font-bold">학생 계정 관리</h3>
            <p className="mt-1 text-sm text-muted">
              반 배정, 이름 수정, 코드 재발급, 삭제까지 한 번에 관리할 수 있습니다.
            </p>
          </div>
          <span className="text-sm text-muted">총 {students.length}명</span>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {students.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
            아직 학생이 없습니다. 아래에서 학생을 추가해주세요.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted-light/80 border-b border-border">
                  <th className="px-4 py-3 text-left font-medium text-muted">닉네임</th>
                  <th className="px-4 py-3 text-left font-medium text-muted">반</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">로그인 코드</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">생성일</th>
                  <th className="px-4 py-3 text-center font-medium text-muted">작업</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const isEditing = editingStudentId === student.id && editDraft;
                  return (
                    <tr key={student.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft.nickname}
                            onChange={(event) => setEditDraft((prev) => prev ? { ...prev, nickname: event.target.value } : prev)}
                            className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                          />
                        ) : (
                          <span className="font-medium">{student.nickname ?? '이름 없음'}</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isEditing ? (
                          <select
                            value={editDraft.className}
                            onChange={(event) => setEditDraft((prev) => prev ? { ...prev, className: event.target.value } : prev)}
                            className="w-full rounded-xl border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
                          >
                            {classes.length === 0 ? (
                              <option value="기본반">기본반</option>
                            ) : (
                              classes.map((item) => (
                                <option key={item.id} value={item.class_name}>
                                  {item.grade}학년 {item.class_name}
                                </option>
                              ))
                            )}
                          </select>
                        ) : (
                          <span className="text-muted">{student.class ?? '미배정'}</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center">
                        {revealedCodes.has(student.id) ? (
                          <span className="font-mono font-bold text-primary">
                            {student.student_code}
                          </span>
                        ) : (
                          <button
                            onClick={() => setRevealedCodes((prev) => new Set(prev).add(student.id))}
                            className="text-xs text-primary hover:text-primary-dark"
                          >
                            [코드 보기]
                          </button>
                        )}
                      </td>

                      <td className="px-4 py-3 text-center text-xs text-muted">
                        {new Date(student.created_at).toLocaleDateString('ko-KR')}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveStudent(student.id)}
                                disabled={savingStudentId === student.id}
                                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                              >
                                저장
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-muted-light"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => startEdit(student)}
                              className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-muted-light"
                            >
                              수정
                            </button>
                          )}

                          {resetConfirm === student.id ? (
                            <>
                              <button
                                onClick={() => handleResetCode(student.id)}
                                className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs text-white"
                              >
                                확인
                              </button>
                              <button
                                onClick={() => setResetConfirm(null)}
                                className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-muted-light"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setResetConfirm(student.id)}
                              className="rounded-xl border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
                            >
                              코드 재발급
                            </button>
                          )}

                          {deleteConfirm === student.id ? (
                            <>
                              <button
                                onClick={() => handleDeleteStudent(student.id)}
                                disabled={savingStudentId === student.id}
                                className="rounded-xl bg-error px-3 py-1.5 text-xs text-white disabled:opacity-50"
                              >
                                삭제 확인
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="rounded-xl border border-border px-3 py-1.5 text-xs hover:bg-muted-light"
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(student.id)}
                              className="rounded-lg border border-error/30 px-3 py-1.5 text-xs text-error hover:bg-error/5"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold mb-1">학생 일괄 등록</h3>
        <p className="text-sm text-muted mb-5">
          번호와 닉네임만 입력하면 됩니다. 이름 등 개인정보는 수집하지 않습니다. (최대 {MAX_STUDENTS}명)
        </p>

        <div className="flex flex-wrap items-end gap-4 mb-5">
          <div className="min-w-[180px]">
            <label htmlFor="student-class" className="mb-2 block text-sm font-medium text-foreground">
              배정할 반
            </label>
            <select
              id="student-class"
              value={selectedClassName}
              onChange={(event) => setSelectedClassName(event.target.value)}
              className="w-full rounded-xl border border-border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15"
            >
              {classes.length === 0 ? (
                <option value="기본반">기본반</option>
              ) : (
                classes.map((item) => (
                  <option key={item.id} value={item.class_name}>
                    {item.grade}학년 {item.class_name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              인원 수
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleCountChange(studentCount - 1)}
                disabled={studentCount <= 1}
                className="flex h-[46px] w-10 items-center justify-center rounded-l-xl border border-border text-lg font-medium hover:bg-muted-light disabled:opacity-30"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={MAX_STUDENTS}
                value={studentCount}
                onChange={(e) => handleCountChange(Number(e.target.value) || 1)}
                className="h-[46px] w-14 border-y border-border text-center text-sm font-medium focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                onClick={() => handleCountChange(studentCount + 1)}
                disabled={studentCount >= MAX_STUDENTS}
                className="flex h-[46px] w-10 items-center justify-center rounded-r-xl border border-border text-lg font-medium hover:bg-muted-light disabled:opacity-30"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted-light/80 border-b border-border">
                <th className="w-16 px-4 py-3 text-center font-medium text-muted">번호</th>
                <th className="px-4 py-3 text-left font-medium text-muted">닉네임</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((nickname, idx) => (
                <tr key={idx} className="border-b border-border last:border-b-0">
                  <td className="px-4 py-2 text-center font-mono text-sm font-semibold text-muted">
                    {idx + 1}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      ref={(el) => { nicknameRefs.current[idx] = el; }}
                      type="text"
                      value={nickname}
                      onChange={(e) => updateEntry(idx, e.target.value)}
                      onKeyDown={(e) => handleEntryKeyDown(idx, e)}
                      placeholder={`${idx + 1}번 학생 닉네임`}
                      maxLength={20}
                      className="w-full rounded-lg border-0 bg-transparent px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/15 placeholder:text-muted/40"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-muted">
            {filledCount > 0
              ? `${filledCount}명 입력됨`
              : '닉네임을 입력해주세요'}
          </span>
          <button
            onClick={handleBulkCreate}
            disabled={creating || filledCount === 0}
            className="rounded-xl bg-foreground px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:opacity-50"
          >
            {creating ? '생성 중...' : `학생 계정 발급 (${filledCount}명)`}
          </button>
        </div>
      </div>

      {createdStudents && (
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-bold text-emerald-700">
              {createdStudents.length}명의 학생 계정이 생성되었습니다
            </h3>
            <button
              onClick={copyAllCodes}
              className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
            >
              전체 복사
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-emerald-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-emerald-100 bg-emerald-50/50">
                  <th className="w-14 px-3 py-2 text-center font-medium text-emerald-600">번호</th>
                  <th className="px-3 py-2 text-left font-medium text-emerald-600">닉네임</th>
                  <th className="px-3 py-2 text-center font-medium text-emerald-600">로그인 코드</th>
                  <th className="w-14 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {createdStudents.map((student) => (
                  <tr
                    key={`${student.number}-${student.nickname}`}
                    className="border-b border-emerald-50 last:border-b-0 bg-white"
                  >
                    <td className="px-3 py-2.5 text-center font-mono text-sm font-semibold text-emerald-600">
                      {student.number}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{student.nickname}</td>
                    <td className="px-3 py-2.5 text-center font-mono font-bold text-primary">
                      {student.code}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => copyToClipboard(student.code)}
                        className="text-xs text-muted hover:text-foreground"
                      >
                        복사
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
