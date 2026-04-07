'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setStudentCode(cleaned);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <motion.div
        className="w-full max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-heading text-primary">World Docent</h1>
          <p className="text-muted mt-1">글로벌 독서 여행</p>
        </div>

        {/* Book-shaped login card */}
        <div className="bg-card rounded-2xl shadow-xl overflow-hidden border border-border">
          <div className="flex flex-col md:flex-row">
            {/* Left page - decorative (hidden on mobile) */}
            <div className="hidden md:flex md:w-2/5 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10 p-8 flex-col items-center justify-center relative border-r border-border/50">
              {/* Stacked books illustration */}
              <div className="relative w-32 h-40 mb-6">
                <div className="absolute bottom-0 left-2 w-24 h-8 bg-secondary/60 rounded-sm rotate-[-3deg] shadow-sm" />
                <div className="absolute bottom-6 left-0 w-26 h-8 bg-primary/50 rounded-sm rotate-[2deg] shadow-sm" />
                <div className="absolute bottom-12 left-3 w-22 h-8 bg-accent/50 rounded-sm rotate-[-1deg] shadow-sm" />
                <div className="absolute bottom-18 left-1 w-24 h-8 bg-secondary-dark/40 rounded-sm rotate-[1deg] shadow-sm" />
                <div className="absolute bottom-24 left-2 w-20 h-8 bg-primary/40 rounded-sm rotate-[-2deg] shadow-sm" />
              </div>

              <h2 className="font-heading text-xl text-foreground mb-2 text-center">
                책과 함께 떠나는<br />세계 여행
              </h2>
              <p className="text-sm text-muted text-center leading-relaxed">
                다양한 나라의 이야기를 읽고<br />
                나만의 이야기를 만들어보세요
              </p>

              {/* Decorative dots */}
              <div className="flex gap-1.5 mt-6">
                <div className="w-2 h-2 rounded-full bg-primary/30" />
                <div className="w-2 h-2 rounded-full bg-secondary/30" />
                <div className="w-2 h-2 rounded-full bg-accent/30" />
              </div>
            </div>

            {/* Right page - form */}
            <div className="flex-1">
              {/* Tabs */}
              <div className="flex border-b border-border">
                <button
                  onClick={() => {
                    setActiveTab('student');
                    setError(null);
                  }}
                  className={`flex-1 py-3.5 text-center text-sm font-medium transition-colors ${
                    activeTab === 'student'
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
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
                  className={`flex-1 py-3.5 text-center text-sm font-medium transition-colors ${
                    activeTab === 'teacher'
                      ? 'text-primary border-b-2 border-primary bg-primary/5'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  교사
                </button>
              </div>

              <div className="p-6">
                {/* Error Message */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Student Login */}
                <AnimatePresence mode="wait">
                  {activeTab === 'student' && (
                    <motion.form
                      key="student"
                      onSubmit={handleStudentSubmit}
                      className="space-y-5"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* Library card style */}
                      <div className="border-2 border-dashed border-border rounded-xl p-5 bg-muted-light/50">
                        <div className="text-center mb-4">
                          <span className="text-xs font-heading tracking-widest text-muted uppercase">
                            Library Card
                          </span>
                        </div>
                        <label
                          htmlFor="student-code"
                          className="block text-sm font-medium text-foreground mb-2 text-center"
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
                          placeholder="000000"
                          className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent placeholder:text-border placeholder:tracking-[0.5em]"
                          disabled={isPending}
                        />
                        <p className="mt-2 text-xs text-muted text-center">
                          선생님이 알려준 6자리 숫자 코드를 입력하세요
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isPending || studentCode.length !== 6}
                        className="w-full py-3 bg-primary text-white rounded-full font-heading text-base hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                      >
                        {isPending ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          '독서 여행 시작하기'
                        )}
                      </button>
                    </motion.form>
                  )}

                  {/* Teacher Login */}
                  {activeTab === 'teacher' && (
                    <motion.form
                      key="teacher"
                      onSubmit={handleTeacherSubmit}
                      className="space-y-4"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ duration: 0.2 }}
                    >
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
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
                          className="w-full px-4 py-2.5 border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          disabled={isPending}
                          required
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isPending}
                        className="w-full py-3 bg-primary text-white rounded-full font-heading text-base hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                      >
                        {isPending ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          '교사 로그인'
                        )}
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted mt-6">
          World Docent &copy; 2024. 글로벌 독서 교육 플랫폼
        </p>
      </motion.div>
    </div>
  );
}
