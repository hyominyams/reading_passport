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

  // Teacher form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Student form state
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
    // Only allow digits, max 6
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setStudentCode(cleaned);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted-light px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">World Docent</h1>
          <p className="text-muted mt-2">글로벌 독서 여행</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-border">
            <button
              onClick={() => {
                setActiveTab('student');
                setError(null);
              }}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                activeTab === 'student'
                  ? 'text-primary border-b-2 border-primary bg-blue-50/50'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              학생
            </button>
            <button
              onClick={() => {
                setActiveTab('teacher');
                setError(null);
              }}
              className={`flex-1 py-3 text-center text-sm font-medium transition-colors ${
                activeTab === 'teacher'
                  ? 'text-primary border-b-2 border-primary bg-blue-50/50'
                  : 'text-muted hover:text-foreground'
              }`}
            >
              교사
            </button>
          </div>

          <div className="p-6">
            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-error">
                {error}
              </div>
            )}

            {/* Student Login */}
            {activeTab === 'student' && (
              <form onSubmit={handleStudentSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="student-code"
                    className="block text-sm font-medium text-foreground mb-2"
                  >
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
                    placeholder="6자리 코드를 입력하세요"
                    className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-sm placeholder:tracking-normal"
                    disabled={isPending}
                  />
                  <p className="mt-1 text-xs text-muted">
                    선생님이 알려준 6자리 숫자 코드를 입력하세요
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isPending || studentCode.length !== 6}
                  className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    '독서 여행 시작하기'
                  )}
                </button>
              </form>
            )}

            {/* Teacher Login */}
            {activeTab === 'teacher' && (
              <form onSubmit={handleTeacherSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    이메일
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="teacher@school.ac.kr"
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={isPending}
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-foreground mb-1"
                  >
                    비밀번호
                  </label>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="비밀번호를 입력하세요"
                    className="w-full px-4 py-2.5 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                    disabled={isPending}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isPending ? (
                    <LoadingSpinner size="sm" />
                  ) : (
                    '교사 로그인'
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          World Docent &copy; 2024. 글로벌 독서 교육 플랫폼
        </p>
      </div>
    </div>
  );
}
