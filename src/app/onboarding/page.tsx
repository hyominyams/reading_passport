'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const avatarOptions = [
  { key: 'lion', emoji: '\u{1F981}' },
  { key: 'rabbit', emoji: '\u{1F430}' },
  { key: 'fox', emoji: '\u{1F98A}' },
  { key: 'bear', emoji: '\u{1F43B}' },
  { key: 'panda', emoji: '\u{1F43C}' },
  { key: 'koala', emoji: '\u{1F428}' },
  { key: 'tiger', emoji: '\u{1F42F}' },
  { key: 'frog', emoji: '\u{1F438}' },
  { key: 'unicorn', emoji: '\u{1F984}' },
  { key: 'dog', emoji: '\u{1F436}' },
];

export default function OnboardingPage() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    if (!selectedAvatar) {
      setError('아바타를 선택해주세요.');
      return;
    }
    if (!user) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('users')
        .update({ nickname: nickname.trim(), avatar: selectedAvatar })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      router.push('/map');
    } catch (err) {
      console.error('Onboarding error:', err);
      setError('저장 중 오류가 발생했습니다. 다시 시도해주세요.');
    }

    setSubmitting(false);
  };

  if (authLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <LoadingSpinner message="로딩 중..." />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted-light px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-primary mb-2">
              World Docent에 오신 것을 환영해요!
            </h1>
            <p className="text-sm text-muted">
              닉네임과 아바타를 선택하고 독서 여행을 시작하세요
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-error">
              {error}
            </div>
          )}

          <div className="mb-6">
            <label
              htmlFor="nickname"
              className="block text-sm font-medium text-foreground mb-2"
            >
              닉네임
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="사용할 닉네임을 입력하세요"
              maxLength={20}
              className="w-full px-4 py-3 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              disabled={submitting}
            />
          </div>

          <div className="mb-8">
            <label className="block text-sm font-medium text-foreground mb-3">
              아바타 선택
            </label>
            <div className="grid grid-cols-5 gap-3">
              {avatarOptions.map((avatar) => (
                <button
                  key={avatar.key}
                  onClick={() => setSelectedAvatar(avatar.key)}
                  disabled={submitting}
                  className={`
                    flex items-center justify-center p-3 rounded-xl text-3xl
                    transition-all duration-200
                    ${
                      selectedAvatar === avatar.key
                        ? 'bg-primary/10 ring-2 ring-primary scale-110 shadow-md'
                        : 'bg-card hover:bg-card-hover hover:scale-105'
                    }
                  `}
                >
                  {avatar.emoji}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={submitting || !nickname.trim() || !selectedAvatar}
            className="w-full py-3 bg-primary text-white rounded-xl font-bold text-base hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '저장 중...' : '시작하기'}
          </button>
        </div>
      </div>
    </main>
  );
}
