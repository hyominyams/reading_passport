'use client';

import { useState, useEffect, useCallback } from 'react';
import type { User } from '@/types/database';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function StudentCreator() {
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdStudents, setCreatedStudents] = useState<{ nickname: string; code: string }[] | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Set<string>>(new Set());
  const [resetConfirm, setResetConfirm] = useState<string | null>(null);
  const [error, setError] = useState('');

  const fetchStudents = useCallback(async () => {
    const res = await fetch('/api/teacher/students');
    const data = await res.json();
    setStudents(data.students ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  const handleBulkCreate = async () => {
    setError('');
    const nicknames = input
      .split(/[,\n]/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    if (nicknames.length === 0) {
      setError('학생 닉네임을 입력해주세요');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/teacher/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_create', nicknames }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '학생 생성에 실패했습니다');
      }

      setCreatedStudents(data.students);
      setInput('');
      fetchStudents();
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

      if (res.ok) {
        setResetConfirm(null);
        fetchStudents();
      }
    } catch {
      // Silently handle
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const copyAllCodes = () => {
    if (!createdStudents) return;
    const text = createdStudents
      .map((s) => `${s.nickname}: ${s.code}`)
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
      {/* Existing students */}
      <div>
        <h3 className="text-base font-bold mb-3">학생 목록</h3>
        {students.length === 0 ? (
          <div className="text-center py-8 text-muted border border-dashed border-border rounded-xl">
            아직 학생이 없습니다. 아래에서 학생을 추가해주세요.
          </div>
        ) : (
          <div className="overflow-x-auto border border-border rounded-xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted-light border-b border-border">
                  <th className="text-left px-4 py-3 font-medium text-muted">닉네임</th>
                  <th className="text-center px-4 py-3 font-medium text-muted">로그인 코드</th>
                  <th className="text-center px-4 py-3 font-medium text-muted">생성일</th>
                  <th className="text-center px-4 py-3 font-medium text-muted">작업</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => (
                  <tr key={student.id} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-3 font-medium">{student.nickname}</td>
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
                    <td className="px-4 py-3 text-center text-muted text-xs">
                      {new Date(student.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {resetConfirm === student.id ? (
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleResetCode(student.id)}
                            className="text-xs px-2 py-1 bg-error text-white rounded"
                          >
                            확인
                          </button>
                          <button
                            onClick={() => setResetConfirm(null)}
                            className="text-xs px-2 py-1 border border-border rounded"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setResetConfirm(student.id)}
                          className="text-xs text-muted hover:text-foreground"
                        >
                          코드 재발급
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bulk create */}
      <div className="border border-border rounded-xl p-5">
        <h3 className="text-base font-bold mb-3">학생 일괄 등록</h3>
        <p className="text-sm text-muted mb-3">
          학생 닉네임을 쉼표(,) 또는 줄바꿈으로 구분하여 입력하세요
        </p>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="예: 지민, 수아, 서준, 하은&#10;또는 줄바꿈으로 구분"
          rows={4}
          className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none mb-3"
        />

        {error && <p className="text-sm text-error mb-3">{error}</p>}

        <button
          onClick={handleBulkCreate}
          disabled={creating || !input.trim()}
          className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium disabled:opacity-50"
        >
          {creating ? '생성 중...' : '일괄 발급'}
        </button>
      </div>

      {/* Created students result */}
      {createdStudents && (
        <div className="border border-success/30 bg-success/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-bold text-success">
              {createdStudents.length}명의 학생이 생성되었습니다
            </h3>
            <button
              onClick={copyAllCodes}
              className="text-xs px-3 py-1.5 border border-success/30 text-success rounded-lg hover:bg-success/10"
            >
              전체 복사
            </button>
          </div>
          <div className="space-y-2">
            {createdStudents.map((s, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-white px-4 py-2 rounded-lg"
              >
                <span className="font-medium text-sm">{s.nickname}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-primary">{s.code}</span>
                  <button
                    onClick={() => copyToClipboard(s.code)}
                    className="text-xs text-muted hover:text-foreground"
                  >
                    복사
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
