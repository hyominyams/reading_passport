'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import {
  avatarOptions,
  buildAutoNickname,
  getAvatarEmoji,
  getRoleLabel,
} from '@/lib/profile';
import type { StampType, User } from '@/types/database';

const requiredStamps: StampType[] = ['read', 'hidden', 'character', 'mystory'];

type StudentActivityRow = {
  created_at: string;
  stamps_earned: StampType[] | null;
  book: { title: string | null } | null;
};

type TeacherStudentRow = Pick<User, 'id' | 'nickname' | 'student_code' | 'created_at'>;

type StudentStats = {
  booksStarted: number;
  completedBooks: number;
  totalStamps: number;
  storyCount: number;
  latestBookTitle: string | null;
  latestActivityAt: string | null;
};

type TeacherStats = {
  studentCount: number;
  activeStudentCount: number;
  storyCount: number;
  flaggedChatCount: number;
  recentStudents: TeacherStudentRow[];
};

type ProfileStats =
  | { kind: 'student'; value: StudentStats }
  | { kind: 'teacher'; value: TeacherStats };

function formatDate(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('ko-KR');
}

export default function MyPage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [nickname, setNickname] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) {
      return;
    }

    setNickname(buildAutoNickname(profile));
    setSchool(profile.school ?? '');
    setGrade(profile.grade ? String(profile.grade) : '');
    setClassName(profile.class ?? '');
    setSelectedAvatar(profile.avatar ?? null);
  }, [profile]);

  useEffect(() => {
    if (!user || !profile) {
      setStats(null);
      setStatsLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const fetchStats = async () => {
      setStatsLoading(true);

      try {
        if (profile.role === 'student') {
          const [activitiesResult, storiesResult] = await Promise.all([
            supabase
              .from('activities')
              .select('created_at, stamps_earned, book:books(title)')
              .eq('student_id', user.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('stories')
              .select('id', { count: 'exact', head: true })
              .eq('student_id', user.id)
              .not('final_text', 'is', null),
          ]);

          if (cancelled) {
            return;
          }

          const activities = (activitiesResult.data ?? []) as StudentActivityRow[];
          const latestActivity = activities[0];
          const totalStamps = activities.reduce((sum, activity) => {
            return sum + new Set(activity.stamps_earned ?? []).size;
          }, 0);
          const completedBooks = activities.filter((activity) =>
            requiredStamps.every((stamp) => (activity.stamps_earned ?? []).includes(stamp))
          ).length;

          setStats({
            kind: 'student',
            value: {
              booksStarted: activities.length,
              completedBooks,
              totalStamps,
              storyCount: storiesResult.count ?? 0,
              latestBookTitle: latestActivity?.book?.title ?? null,
              latestActivityAt: latestActivity?.created_at ?? null,
            },
          });
          return;
        }

        const { data: studentRows, error: studentsError } = await supabase
          .from('users')
          .select('id, nickname, student_code, created_at')
          .eq('teacher_id', user.id)
          .eq('role', 'student')
          .order('created_at', { ascending: false });

        if (studentsError) {
          throw studentsError;
        }

        if (cancelled) {
          return;
        }

        const students = (studentRows ?? []) as TeacherStudentRow[];
        const studentIds = students.map((student) => student.id);

        if (studentIds.length === 0) {
          setStats({
            kind: 'teacher',
            value: {
              studentCount: 0,
              activeStudentCount: 0,
              storyCount: 0,
              flaggedChatCount: 0,
              recentStudents: [],
            },
          });
          return;
        }

        const [activitiesResult, storiesResult, flaggedChatsResult] = await Promise.all([
          supabase.from('activities').select('student_id').in('student_id', studentIds),
          supabase
            .from('stories')
            .select('id', { count: 'exact', head: true })
            .in('student_id', studentIds)
            .not('final_text', 'is', null),
          supabase
            .from('chat_logs')
            .select('id', { count: 'exact', head: true })
            .in('student_id', studentIds)
            .eq('flagged', true),
        ]);

        if (cancelled) {
          return;
        }

        const activeStudentCount = new Set(
          (activitiesResult.data ?? []).map((activity) => activity.student_id)
        ).size;

        setStats({
          kind: 'teacher',
          value: {
            studentCount: students.length,
            activeStudentCount,
            storyCount: storiesResult.count ?? 0,
            flaggedChatCount: flaggedChatsResult.count ?? 0,
            recentStudents: students.slice(0, 5),
          },
        });
      } catch (error) {
        console.error('Failed to load mypage stats:', error);

        if (!cancelled) {
          setStats(null);
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    };

    void fetchStats();

    return () => {
      cancelled = true;
    };
  }, [profile, user]);

  const profilePreview = useMemo(() => {
    if (!profile) {
      return null;
    }

    return {
      ...profile,
      nickname: nickname.trim() || buildAutoNickname(profile),
      avatar: selectedAvatar,
    };
  }, [nickname, profile, selectedAvatar]);

  const quickLinks = useMemo(() => {
    if (!profile) {
      return [];
    }

    if (profile.role === 'student') {
      return [
        { href: '/map', label: '책 고르기' },
        { href: '/passport', label: '여권 보기' },
        { href: '/library', label: '서재 보기' },
      ];
    }

    return [
      { href: '/teacher', label: '교사 대시보드' },
      { href: '/library', label: '학생 작품 보기' },
      ...(profile.role === 'admin' ? [{ href: '/admin', label: '관리자 페이지' }] : []),
    ];
  }, [profile]);

  const statCards = useMemo(() => {
    if (!stats) {
      return [];
    }

    if (stats.kind === 'student') {
      return [
        { label: '시작한 책', value: `${stats.value.booksStarted}권` },
        { label: '완성한 여권', value: `${stats.value.completedBooks}개` },
        { label: '획득한 도장', value: `${stats.value.totalStamps}개` },
        { label: '완성한 이야기', value: `${stats.value.storyCount}편` },
      ];
    }

    return [
      { label: '담당 학생', value: `${stats.value.studentCount}명` },
      { label: '활동 시작 학생', value: `${stats.value.activeStudentCount}명` },
      { label: '완성된 작품', value: `${stats.value.storyCount}편` },
      { label: '검토 필요 대화', value: `${stats.value.flaggedChatCount}건` },
    ];
  }, [stats]);

  const handleSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user || !profile) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    const nextNickname = nickname.trim() || buildAutoNickname(profile);
    const supabase = createClient();

    try {
      const updates: {
        nickname: string;
        avatar?: string | null;
        school?: string | null;
        grade?: number | null;
        class?: string | null;
      } = {
        nickname: nextNickname,
      };

      if (profile.role === 'student') {
        updates.avatar = selectedAvatar;
      } else {
        const trimmedGrade = grade.trim();
        const parsedGrade = trimmedGrade ? Number(trimmedGrade) : null;

        if (
          trimmedGrade &&
          (!Number.isInteger(parsedGrade) || parsedGrade < 1 || parsedGrade > 12)
        ) {
          setSaveError('학년은 1부터 12 사이 숫자로 입력해주세요.');
          setSaving(false);
          return;
        }

        updates.school = school.trim() || null;
        updates.grade = parsedGrade;
        updates.class = className.trim() || null;
      }

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      await refreshProfile();
      setSaveSuccess('프로필을 저장했습니다.');
      setNickname(nextNickname);
    } catch (error) {
      console.error('Failed to save profile:', error);
      setSaveError('프로필 저장 중 오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !profilePreview || !profile) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center bg-muted-light/40">
          <LoadingSpinner message="마이페이지를 불러오는 중..." />
        </main>
      </>
    );
  }

  const avatarEmoji = getAvatarEmoji(profilePreview.avatar);
  const roleLabel = getRoleLabel(profile.role);
  const displayName = buildAutoNickname(profilePreview);

  return (
    <>
      <Header />
      <main className="flex-1 bg-muted-light/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
            <section className="space-y-6">
              <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-18 w-18 shrink-0 items-center justify-center rounded-3xl bg-foreground/[0.06] text-3xl">
                      {avatarEmoji ?? displayName.charAt(0)}
                    </div>
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-foreground text-xs font-medium text-white px-3 py-1">
                          {roleLabel}
                        </span>
                        {profile.role === 'student' && profile.student_code && (
                          <span className="rounded-full bg-muted-light text-xs font-medium text-foreground px-3 py-1">
                            학생 코드 {profile.student_code}
                          </span>
                        )}
                      </div>
                      <h1 className="text-2xl font-heading font-bold text-foreground">
                        {displayName}
                      </h1>
                      <p className="mt-1 text-sm text-muted">
                        {profile.email ?? '이메일 정보 없음'}
                      </p>
                      <div className="mt-4 grid gap-2 text-sm text-muted sm:grid-cols-2">
                        <div>가입일 {formatDate(profile.created_at)}</div>
                        <div>
                          {profile.role === 'student'
                            ? `학급 ${profile.class ?? '미설정'}`
                            : `학교 ${profile.school ?? '미설정'}`}
                        </div>
                        {profile.role !== 'student' && (
                          <div>
                            반 정보 {profile.grade ? `${profile.grade}학년` : '-'} {profile.class ?? ''}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {quickLinks.map((link) => (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="inline-flex items-center justify-center rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted-light"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-border bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-heading font-semibold text-foreground">
                      내 활동 요약
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      지금까지의 학습 현황과 운영 지표를 한눈에 확인하세요.
                    </p>
                  </div>
                </div>

                {statsLoading ? (
                  <div className="flex min-h-40 items-center justify-center">
                    <LoadingSpinner message="현황을 불러오는 중..." />
                  </div>
                ) : stats ? (
                  <div className="space-y-5">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {statCards.map((card) => (
                        <article
                          key={card.label}
                          className="rounded-2xl border border-border bg-muted-light/50 p-4"
                        >
                          <p className="text-sm text-muted">{card.label}</p>
                          <p className="mt-2 text-2xl font-heading font-semibold text-foreground">
                            {card.value}
                          </p>
                        </article>
                      ))}
                    </div>

                    {stats.kind === 'student' ? (
                      <div className="rounded-2xl border border-border bg-white p-5">
                        <h3 className="text-base font-semibold text-foreground">
                          최근 학습 기록
                        </h3>
                        <div className="mt-4 grid gap-3 text-sm text-muted sm:grid-cols-2">
                          <div className="rounded-2xl bg-muted-light/60 p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-muted">
                              Last Book
                            </div>
                            <div className="mt-2 text-base font-medium text-foreground">
                              {stats.value.latestBookTitle ?? '아직 시작한 책이 없습니다'}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-muted-light/60 p-4">
                            <div className="text-xs uppercase tracking-[0.16em] text-muted">
                              Last Activity
                            </div>
                            <div className="mt-2 text-base font-medium text-foreground">
                              {formatDate(stats.value.latestActivityAt)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border bg-white p-5">
                        <h3 className="text-base font-semibold text-foreground">
                          최근 등록 학생
                        </h3>
                        <div className="mt-4 space-y-3">
                          {stats.value.recentStudents.length === 0 ? (
                            <p className="text-sm text-muted">
                              아직 등록된 학생이 없습니다.
                            </p>
                          ) : (
                            stats.value.recentStudents.map((student) => (
                              <div
                                key={student.id}
                                className="flex items-center justify-between rounded-2xl bg-muted-light/60 px-4 py-3"
                              >
                                <div>
                                  <div className="font-medium text-foreground">
                                    {buildAutoNickname({
                                      id: student.id,
                                      role: 'student',
                                      nickname: student.nickname,
                                      student_code: student.student_code,
                                    })}
                                  </div>
                                  <div className="text-xs text-muted">
                                    등록일 {formatDate(student.created_at)}
                                  </div>
                                </div>
                                <div className="text-sm font-medium text-muted">
                                  {student.student_code ?? '코드 없음'}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl bg-muted-light/60 p-5 text-sm text-muted">
                    현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-6">
              <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-heading font-semibold text-foreground">
                  프로필 설정
                </h2>
                <p className="mt-1 text-sm text-muted">
                  닉네임은 비워두면 기본값으로 자동 저장됩니다.
                </p>

                <form className="mt-6 space-y-5" onSubmit={handleSave}>
                  {saveError && (
                    <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error">
                      {saveError}
                    </div>
                  )}

                  {saveSuccess && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                      {saveSuccess}
                    </div>
                  )}

                  <div>
                    <label
                      htmlFor="nickname"
                      className="mb-2 block text-sm font-medium text-foreground"
                    >
                      닉네임
                    </label>
                    <input
                      id="nickname"
                      type="text"
                      value={nickname}
                      onChange={(event) => setNickname(event.target.value)}
                      placeholder={buildAutoNickname(profile)}
                      maxLength={20}
                      disabled={saving}
                      className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15"
                    />
                  </div>

                  {profile.role === 'student' ? (
                    <div>
                      <div className="mb-3 block text-sm font-medium text-foreground">
                        아바타
                      </div>
                      <div className="grid grid-cols-5 gap-3">
                        {avatarOptions.map((option) => (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setSelectedAvatar(option.key)}
                            disabled={saving}
                            className={`flex h-14 items-center justify-center rounded-2xl border text-2xl transition-transform hover:scale-[1.03] ${
                              selectedAvatar === option.key
                                ? 'border-foreground bg-foreground/[0.06]'
                                : 'border-border bg-white'
                            }`}
                          >
                            {option.emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label
                          htmlFor="school"
                          className="mb-2 block text-sm font-medium text-foreground"
                        >
                          학교
                        </label>
                        <input
                          id="school"
                          type="text"
                          value={school}
                          onChange={(event) => setSchool(event.target.value)}
                          placeholder="학교명을 입력하세요"
                          disabled={saving}
                          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="grade"
                            className="mb-2 block text-sm font-medium text-foreground"
                          >
                            학년
                          </label>
                          <input
                            id="grade"
                            type="number"
                            min={1}
                            max={12}
                            value={grade}
                            onChange={(event) => setGrade(event.target.value)}
                            placeholder="예: 4"
                            disabled={saving}
                            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="class-name"
                            className="mb-2 block text-sm font-medium text-foreground"
                          >
                            반
                          </label>
                          <input
                            id="class-name"
                            type="text"
                            value={className}
                            onChange={(event) => setClassName(event.target.value)}
                            placeholder="예: 2반"
                            disabled={saving}
                            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/15"
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-2xl bg-foreground px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? '저장 중...' : '프로필 저장'}
                  </button>
                </form>
              </section>

              <section className="rounded-3xl border border-border bg-white p-6 shadow-sm">
                <h2 className="text-lg font-heading font-semibold text-foreground">
                  안내
                </h2>
                <div className="mt-4 space-y-3 text-sm text-muted">
                  <p>
                    닉네임이 비어 있는 계정은 로그인 시 자동으로 기본 닉네임이 설정됩니다.
                  </p>
                  <p>
                    학생은 여기서 아바타를 바꾸고, 교사는 학교와 반 정보를 바로 수정할 수 있습니다.
                  </p>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>
    </>
  );
}
