'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { teacherLogin, studentLogin } from './actions';
import LoadingSpinner from '@/components/common/LoadingSpinner';

type TabType = 'teacher' | 'student';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<TabType>('student');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentCode, setStudentCode] = useState('');

  const handleTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await teacherLogin(email, password);
      if (result.success) {
        router.push(result.redirectTo || '/teacher');
        router.refresh();
      } else {
        setError(result.error || '로그인에 실패했습니다.');
      }
    });
  };

  const handleStudentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (studentCode.length !== 6) {
      setError('학생 코드는 6자리입니다.');
      return;
    }
    startTransition(async () => {
      const result = await studentLogin(studentCode);
      if (result.success) {
        router.push(result.redirectTo || '/map');
        router.refresh();
      } else {
        setError(result.error || '로그인에 실패했습니다.');
      }
    });
  };

  const handleCodeInput = (value: string) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setStudentCode(cleaned);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5a17.92 17.92 0 01-8.716-2.247m0 0A9 9 0 013 12c0-1.605.42-3.113 1.157-4.418" />
            </svg>
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">World Stories</h1>
          <p className="text-sm text-muted mt-1">디지털 독서 여권</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              type="button"
              onClick={() => { setActiveTab('student'); setError(null); }}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                activeTab === 'student'
                  ? 'text-foreground border-b-2 border-foreground'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              학생
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('teacher'); setError(null); }}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                activeTab === 'teacher'
                  ? 'text-foreground border-b-2 border-foreground'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              교사
            </button>
          </div>

          <div className="p-6">
            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg border border-error/15 bg-error/5 p-3 text-sm text-error">
                {error}
              </div>
            )}

            {activeTab === 'student' ? (
              <form onSubmit={handleStudentSubmit} className="space-y-5">
                <div>
                  <label htmlFor="student-code" className="block text-sm font-medium text-foreground mb-2">
                    학생 코드
                  </label>
                  <input
                    id="student-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={studentCode}
                    onChange={(e) => handleCodeInput(e.target.value)}
                    placeholder="000000"
                    className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-heading border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 placeholder:text-border placeholder:tracking-[0.5em]"
                    disabled={isPending}
                  />
                  <p className="mt-2 text-xs text-muted">
                    선생님이 알려준 6자리 숫자 코드를 입력하세요
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isPending || studentCode.length !== 6}
                  className="w-full py-3 bg-foreground text-white rounded-xl font-medium text-sm hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPending ? <LoadingSpinner size="sm" /> : '시작하기'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleTeacherSubmit} className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-foreground mb-1.5">
                    이메일
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.ac.kr"
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 text-sm"
                    disabled={isPending}
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-foreground mb-1.5">
                    비밀번호
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full px-4 py-2.5 border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-foreground/20 focus:border-foreground/30 text-sm"
                    disabled={isPending}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 bg-foreground text-white rounded-xl font-medium text-sm hover:bg-foreground/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPending ? <LoadingSpinner size="sm" /> : '로그인'}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-8">
          World Docent &copy; 2026
        </p>
      </div>
    </div>
  );
}
