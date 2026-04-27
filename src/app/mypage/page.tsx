'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import BookViewerModal from '@/components/story/BookViewerModal';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { getDetailStepProgressLabel, getStepRouteWithLang } from '@/lib/mystory-steps';
import { normalizeTranslatedTextsMap } from '@/lib/story-translations';
import { getStoryVisibilityLabel, normalizeStoryVisibility } from '@/lib/story-visibility';
import { getCoverTypographyFont, normalizeStorybookFontSize } from '@/lib/storybook-fonts';
import {
  avatarOptions,
  buildAutoNickname,
  getAvatarEmoji,
  getRoleLabel,
} from '@/lib/profile';
import {
  getWorldSmartCategoryMeta,
  type MyWorldSmartSummary,
} from '@/lib/world-smart';
import type { CoverDesign, IllustrationStyle, ProductionStatus, StampType, StoryStatus, User, Visibility } from '@/types/database';

const requiredStamps: StampType[] = ['read', 'hidden', 'questions', 'mystory'];

type StudentActivityRow = {
  created_at: string;
  stamps_earned: StampType[] | null;
  book: { title: string | null }[] | null;
};

type TeacherStudentRow = Pick<User, 'id' | 'nickname' | 'student_code' | 'created_at'>;

type MyStoryRow = {
  id: string;
  book_id: string;
  cover_image_url: string | null;
  cover_design: CoverDesign | null;
  illustration_style: IllustrationStyle | null;
  scene_images: string[] | null;
  final_text: string[] | null;
  translation_text: string[] | null;
  translated_texts: Record<string, string[]> | null;
  visibility: Visibility;
  created_at: string;
  language: string;
};

type ActiveDraftRow = {
  id: string;
  book_id: string;
  language: string;
  current_step: number;
  production_status: ProductionStatus;
  production_progress: number;
  cover_design: CoverDesign | null;
  started_at: string;
  story_status: StoryStatus;
};

type StudentStats = {
  booksStarted: number;
  completedBooks: number;
  totalStamps: number;
  storyCount: number;
  acceptedAnswerCount: number;
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

function getActiveDraftHref(draft: ActiveDraftRow) {
  if (draft.current_step >= 7) {
    const suffix = draft.production_status === 'completed' ? '/finish' : '/creating';
    return `/book/${draft.book_id}/mystory${suffix}?storyId=${draft.id}&lang=${draft.language}`;
  }

  const targetStep = draft.current_step > 1 ? draft.current_step : 1;
  return getStepRouteWithLang(draft.book_id, targetStep, draft.id, draft.language);
}

function getActiveDraftStatusLabel(draft: ActiveDraftRow) {
  if (draft.current_step >= 7) {
    if (draft.production_status === 'completed') return '그림책 완성';
    if (draft.production_status === 'failed') return '제작 멈춤';
    if (draft.production_status === 'processing') return `제작 중 ${draft.production_progress}%`;
  }

  return getDetailStepProgressLabel(draft.current_step);
}

function getActiveDraftActionLabel(draft: ActiveDraftRow) {
  if (draft.current_step >= 7) {
    if (draft.production_status === 'completed') return '완성본 열기';
    if (draft.production_status === 'failed') return '다시 시도하기';
    return '제작 화면 열기';
  }

  return '이어서 하기';
}

const studentStatMeta = [
  { key: 'completedBooks', label: '완성한 여권', suffix: '개', icon: '🛂', gradient: 'from-emerald-500/10 to-teal-500/10', border: 'border-emerald-200/60' },
  { key: 'totalStamps', label: '획득한 도장', suffix: '개', icon: '🏅', gradient: 'from-amber-500/10 to-orange-500/10', border: 'border-amber-200/60' },
  { key: 'acceptedAnswerCount', label: '채택된 답변', suffix: '개', icon: '✨', gradient: 'from-sky-500/10 to-cyan-500/10', border: 'border-sky-200/60' },
  { key: 'storyCount', label: '완성한 이야기', suffix: '편', icon: '✍️', gradient: 'from-purple-500/10 to-pink-500/10', border: 'border-purple-200/60' },
] as const;

const teacherStatMeta = [
  { key: 'studentCount', label: '담당 학생', suffix: '명', icon: '👥', gradient: 'from-blue-500/10 to-indigo-500/10', border: 'border-blue-200/60' },
  { key: 'activeStudentCount', label: '활동 시작 학생', suffix: '명', icon: '🎯', gradient: 'from-emerald-500/10 to-teal-500/10', border: 'border-emerald-200/60' },
  { key: 'storyCount', label: '완성된 작품', suffix: '편', icon: '📚', gradient: 'from-amber-500/10 to-orange-500/10', border: 'border-amber-200/60' },
  { key: 'flaggedChatCount', label: '검토 필요 대화', suffix: '건', icon: '🔍', gradient: 'from-rose-500/10 to-red-500/10', border: 'border-rose-200/60' },
] as const;

const studentQuickLinks = [
  { href: '/map', label: '책 고르기', icon: '🗺️' },
  { href: '/passport', label: '여권 보기', icon: '🛂' },
  { href: '/library', label: '서재 보기', icon: '📚' },
  { href: '/campaign', label: '캠페인', icon: '🏆' },
];

export default function MyPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const [nickname, setNickname] = useState('');
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [myStories, setMyStories] = useState<MyStoryRow[]>([]);
  const [activeDraft, setActiveDraft] = useState<ActiveDraftRow | null>(null);
  const [worldSmartSummary, setWorldSmartSummary] = useState<MyWorldSmartSummary | null>(null);
  const [selectedMyStory, setSelectedMyStory] = useState<MyStoryRow | null>(null);
  const [storyViewerSession, setStoryViewerSession] = useState(0);
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
      setWorldSmartSummary(null);
      setActiveDraft(null);
      setStatsLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    const fetchStats = async () => {
      setStatsLoading(true);

      try {
        if (profile.role === 'student') {
          const worldSmartPromise = fetch('/api/world-smart/me')
            .then(async (response) => {
              const payload = await response.json() as MyWorldSmartSummary | { error?: string };
              if (!response.ok) {
                throw new Error('error' in payload ? payload.error : 'World Smart 정보를 불러오지 못했습니다.');
              }
              return payload as MyWorldSmartSummary;
            })
            .catch((error) => {
              console.error('Failed to load world smart summary:', error);
              return null;
            });

          const [activitiesResult, storiesCountResult, storiesListResult, activeDraftResult, worldSmartResult] = await Promise.all([
            supabase
              .from('activities')
              .select('created_at, stamps_earned, book:book_id(title)')
              .eq('student_id', user.id)
              .order('created_at', { ascending: false }),
            supabase
              .from('stories')
              .select('id', { count: 'exact', head: true })
              .eq('student_id', user.id)
              .not('final_text', 'is', null),
            supabase
              .from('stories')
              .select('id, book_id, cover_image_url, cover_design, illustration_style, scene_images, final_text, translation_text, translated_texts, visibility, created_at, language')
              .eq('student_id', user.id)
              .not('final_text', 'is', null)
              .order('created_at', { ascending: false }),
            supabase
              .from('stories')
              .select('id, book_id, language, current_step, production_status, production_progress, cover_design, started_at, story_status')
              .eq('student_id', user.id)
              .eq('story_status', 'draft')
              .order('started_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
            worldSmartPromise,
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

          setMyStories((storiesListResult.data ?? []) as MyStoryRow[]);
          setActiveDraft((activeDraftResult.data as ActiveDraftRow | null) ?? null);
          setWorldSmartSummary(worldSmartResult);

          setStats({
            kind: 'student',
            value: {
              booksStarted: activities.length,
              completedBooks,
              totalStamps,
              storyCount: storiesCountResult.count ?? 0,
              acceptedAnswerCount: worldSmartResult?.acceptedAnswerCount ?? 0,
              latestBookTitle: latestActivity?.book?.[0]?.title ?? null,
              latestActivityAt: latestActivity?.created_at ?? null,
            },
          });
          return;
        }

        setWorldSmartSummary(null);
        setActiveDraft(null);

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
          (activitiesResult.data ?? []).map((activity: { student_id: string }) => activity.student_id)
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
      return studentQuickLinks;
    }

    return [
      ...(profile.role === 'teacher' ? [{ href: '/teacher', label: '교사 대시보드', icon: '📊' }] : []),
      { href: '/library', label: '학생 작품 보기', icon: '📚' },
      { href: '/campaign', label: '캠페인', icon: '🏆' },
      ...(profile.role === 'admin' ? [{ href: '/admin', label: '관리자', icon: '⚙️' }] : []),
    ];
  }, [profile]);

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
        let parsedGrade: number | null = null;

        if (trimmedGrade) {
          parsedGrade = Number(trimmedGrade);

          if (!Number.isInteger(parsedGrade) || parsedGrade < 1 || parsedGrade > 12) {
            setSaveError('학년은 1부터 12 사이 숫자로 입력해주세요.');
            setSaving(false);
            return;
          }
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

  const handleMyStoryOpen = (story: MyStoryRow) => {
    setStoryViewerSession((prev) => prev + 1);
    setSelectedMyStory(story);
  };

  if (authLoading) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center bg-muted-light/40">
          <LoadingSpinner message="마이페이지를 불러오는 중..." />
        </main>
      </>
    );
  }

  if (!user) {
    router.replace('/login');
    return null;
  }

  if (!profile || !profilePreview) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center bg-muted-light/40">
          <div className="text-center space-y-4">
            <p className="text-sm text-muted">프로필 정보를 불러올 수 없습니다.</p>
            <button
              type="button"
              onClick={() => void refreshProfile()}
              className="rounded-xl bg-foreground px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-foreground/90"
            >
              다시 시도
            </button>
            <p className="text-xs text-muted">문제가 계속되면 선생님에게 문의하세요.</p>
          </div>
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
      <main className="flex-1 bg-muted-light/40 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

          {/* ── Hero profile card ── */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-50 via-white to-blue-50 border border-border/60 shadow-sm"
          >
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-secondary/[0.06]" />
            <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-accent/[0.06]" />

            <div className="relative z-10 p-6 sm:p-8">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-5">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 200 }}
                    className="flex h-20 w-20 sm:h-24 sm:w-24 shrink-0 items-center justify-center rounded-3xl bg-white shadow-lg text-4xl sm:text-5xl border border-border/40"
                  >
                    {avatarEmoji ?? displayName.charAt(0)}
                  </motion.div>
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-foreground text-[11px] font-semibold text-white px-3 py-1 tracking-wide uppercase">
                        {roleLabel}
                      </span>
                      {profile.role === 'student' && profile.student_code && (
                        <span className="inline-flex items-center rounded-full bg-secondary/10 text-[11px] font-medium text-secondary px-3 py-1">
                          CODE {profile.student_code}
                        </span>
                      )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground truncate">
                      {displayName}
                    </h1>
                    <p className="mt-0.5 text-sm text-muted truncate">
                      {profile.email ?? '이메일 정보 없음'}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>가입일 {formatDate(profile.created_at)}</span>
                      <span className="hidden sm:inline text-border">|</span>
                      <span>
                        {profile.role === 'student'
                          ? `학급 ${profile.class ?? '미설정'}`
                          : `${profile.school ?? '학교 미설정'} · ${profile.grade ? `${profile.grade}학년` : ''} ${profile.class ?? ''}`}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {quickLinks.map((link, i) => (
                    <motion.div
                      key={link.href}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.25 + i * 0.06 }}
                    >
                      <Link
                        href={link.href}
                        className="group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-white/80 backdrop-blur-sm px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-all hover:shadow-md hover:bg-white hover:-translate-y-0.5"
                      >
                        <span className="text-base">{link.icon}</span>
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.section>

          {/* ── Stats cards ── */}
          {!statsLoading && stats && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                {(stats.kind === 'student' ? studentStatMeta : teacherStatMeta).map((meta, i) => {
                  const value = stats.value[meta.key as keyof typeof stats.value] as number;
                  return (
                    <motion.article
                      key={meta.key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.08 }}
                      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br ${meta.gradient} ${meta.border} p-4 sm:p-5`}
                    >
                      <div className="pointer-events-none absolute -right-3 -top-3 text-4xl opacity-[0.12]">
                        {meta.icon}
                      </div>
                      <p className="text-xs sm:text-sm font-medium text-muted">{meta.label}</p>
                      <p className="mt-1.5 text-2xl sm:text-3xl font-heading font-bold text-foreground tabular-nums">
                        {value}
                        <span className="ml-0.5 text-sm sm:text-base font-medium text-muted">{meta.suffix}</span>
                      </p>
                    </motion.article>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* ── Recent activity highlights ── */}
          {!statsLoading && stats && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm"
            >
              {stats.kind === 'student' ? (
                <>
                  <h2 className="text-lg font-heading font-semibold text-foreground">최근 학습 기록</h2>
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100/60 p-5">
                      <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-muted/70">
                        Last Book
                      </div>
                      <div className="mt-2 text-base font-medium text-foreground">
                        {stats.value.latestBookTitle ?? '아직 시작한 책이 없습니다'}
                      </div>
                    </div>
                    <div className="rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100/60 p-5">
                      <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-muted/70">
                        Last Activity
                      </div>
                      <div className="mt-2 text-base font-medium text-foreground">
                        {formatDate(stats.value.latestActivityAt)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-violet-100 bg-violet-50 p-5">
                      <div className="text-[10px] font-bold tracking-[0.16em] uppercase text-muted/70">
                        World Smart Badge
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl text-xl ${
                          worldSmartSummary?.badge.current.ringClass ?? 'bg-stone-100 text-stone-700'
                        }`}>
                          {worldSmartSummary?.badge.current.icon ?? '🌱'}
                        </span>
                        <div className="min-w-0">
                          <p className="text-base font-semibold text-foreground">
                            {worldSmartSummary?.badge.current.label ?? '질문 씨앗'}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {worldSmartSummary?.badge.next
                              ? `${worldSmartSummary.badge.next.minAccepted}회 채택까지 ${worldSmartSummary.badge.remainingToNext}개 남았어요`
                              : '최고 배지를 받았어요'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-heading font-semibold text-foreground">최근 등록 학생</h2>
                  <div className="mt-4 space-y-2.5">
                    {stats.value.recentStudents.length === 0 ? (
                      <p className="text-sm text-muted py-4">아직 등록된 학생이 없습니다.</p>
                    ) : (
                      stats.value.recentStudents.map((student, i) => (
                        <motion.div
                          key={student.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.06 }}
                          className="flex items-center justify-between rounded-2xl bg-muted-light/50 border border-border/40 px-4 py-3 transition-colors hover:bg-muted-light"
                        >
                          <div>
                            <div className="font-medium text-foreground text-sm">
                              {buildAutoNickname({
                                id: student.id,
                                role: 'student',
                                nickname: student.nickname,
                                student_code: student.student_code,
                              })}
                            </div>
                            <div className="text-xs text-muted mt-0.5">
                              등록일 {formatDate(student.created_at)}
                            </div>
                          </div>
                          <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-xs font-medium text-muted">
                            {student.student_code ?? '코드 없음'}
                          </span>
                        </motion.div>
                      ))
                    )}
                  </div>
                </>
              )}
            </motion.section>
          )}

          {statsLoading && (
            <div className="flex min-h-40 items-center justify-center rounded-3xl border border-border/60 bg-white shadow-sm">
              <LoadingSpinner message="현황을 불러오는 중..." />
            </div>
          )}

          {stats?.kind === 'student' && activeDraft && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38, duration: 0.5 }}
              className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-border bg-muted-light px-3 py-1 text-xs font-semibold text-muted">
                      이어하기
                    </span>
                    <span className="rounded-full bg-foreground/[0.06] px-3 py-1 text-xs font-semibold text-foreground">
                      {getActiveDraftStatusLabel(activeDraft)}
                    </span>
                  </div>
                  <h2 className="mt-3 truncate text-xl font-heading font-bold text-foreground">
                    {activeDraft.cover_design?.title?.trim() || '진행 중인 그림책'}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    시작일 {formatDate(activeDraft.started_at)}
                  </p>

                  {activeDraft.current_step >= 7 && activeDraft.production_status !== 'completed' && (
                    <div className="mt-4 max-w-md">
                      <div className="h-2 overflow-hidden rounded-full bg-muted-light">
                        <div
                          className="h-full rounded-full bg-foreground transition-all"
                          style={{ width: `${Math.max(0, Math.min(100, activeDraft.production_progress))}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Link
                  href={getActiveDraftHref(activeDraft)}
                  className="inline-flex h-11 shrink-0 items-center justify-center rounded-full bg-foreground px-6 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-foreground/90"
                >
                  {getActiveDraftActionLabel(activeDraft)}
                </Link>
              </div>
            </motion.section>
          )}

          {!statsLoading && !stats && (
            <div className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm">
              <div className="rounded-2xl bg-muted-light/60 p-5 text-sm text-muted text-center">
                현황을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
              </div>
            </div>
          )}

          {/* ── Profile settings + Guide ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="grid gap-6 lg:grid-cols-[1fr_1fr]"
          >
            <section className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">⚙️</span>
                <h2 className="text-lg font-heading font-semibold text-foreground">프로필 설정</h2>
              </div>
              <p className="text-sm text-muted mb-6">
                닉네임은 비워두면 기본값으로 자동 저장됩니다.
              </p>

              <form className="space-y-5" onSubmit={handleSave}>
                {saveError && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-error/20 bg-error/5 px-4 py-3 text-sm text-error"
                  >
                    {saveError}
                  </motion.div>
                )}

                {saveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-accent"
                  >
                    {saveSuccess}
                  </motion.div>
                )}

                <div>
                  <label htmlFor="nickname" className="mb-2 block text-sm font-medium text-foreground">
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
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/40"
                  />
                </div>

                {profile.role === 'student' ? (
                  <div>
                    <div className="mb-3 block text-sm font-medium text-foreground">아바타</div>
                    <div className="grid grid-cols-5 gap-2.5">
                      {avatarOptions.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          onClick={() => setSelectedAvatar(option.key)}
                          disabled={saving}
                          className={`flex h-14 items-center justify-center rounded-xl border-2 text-2xl transition-all hover:scale-105 ${
                            selectedAvatar === option.key
                              ? 'border-secondary bg-secondary/[0.08] shadow-sm shadow-secondary/10'
                              : 'border-border/60 bg-white hover:border-border'
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
                      <label htmlFor="school" className="mb-2 block text-sm font-medium text-foreground">
                        학교
                      </label>
                      <input
                        id="school"
                        type="text"
                        value={school}
                        onChange={(event) => setSchool(event.target.value)}
                        placeholder="학교명을 입력하세요"
                        disabled={saving}
                        className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/40"
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="grade" className="mb-2 block text-sm font-medium text-foreground">
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
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/40"
                        />
                      </div>

                      <div>
                        <label htmlFor="class-name" className="mb-2 block text-sm font-medium text-foreground">
                          반
                        </label>
                        <input
                          id="class-name"
                          type="text"
                          value={className}
                          onChange={(event) => setClassName(event.target.value)}
                          placeholder="예: 2반"
                          disabled={saving}
                          className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground transition-all focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary/40"
                        />
                      </div>
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-foreground/90 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '프로필 저장'}
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-border/60 bg-gradient-to-br from-amber-50/60 via-white to-orange-50/40 p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">💡</span>
                <h2 className="text-lg font-heading font-semibold text-foreground">안내</h2>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl bg-white/70 border border-amber-100/60 p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">닉네임 자동 설정</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    닉네임이 비어 있는 계정은 로그인 시 자동으로 기본 닉네임이 설정됩니다.
                  </p>
                </div>
                <div className="rounded-xl bg-white/70 border border-amber-100/60 p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">프로필 수정</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    학생은 아바타를 바꾸고, 교사는 학교와 반 정보를 바로 수정할 수 있습니다.
                  </p>
                </div>
                {profile.role === 'student' && (
                  <div className="rounded-xl bg-white/70 border border-amber-100/60 p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-1">도장 모으기</h3>
                    <p className="text-sm text-muted leading-relaxed">
                      4단계 활동을 모두 완료하면 해당 국가의 여권 페이지가 완성됩니다!
                    </p>
                  </div>
                )}
              </div>
            </section>
          </motion.div>

          {stats?.kind === 'student' && worldSmartSummary && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.46, duration: 0.5 }}
              className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h2 className="text-lg font-heading font-semibold text-foreground">내 질문</h2>
                  <p className="mt-1 text-sm text-muted">내가 올린 질문을 다시 보고 같은 유형 탭으로 바로 들어갈 수 있어요.</p>
                </div>
                <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${worldSmartSummary.badge.current.toneClass}`}>
                  <span>{worldSmartSummary.badge.current.icon}</span>
                  <span>{worldSmartSummary.badge.current.label}</span>
                  <span>· 채택 {worldSmartSummary.acceptedAnswerCount}개</span>
                </div>
              </div>

              {worldSmartSummary.myQuestions.length === 0 ? (
                <div className="mt-5 rounded-2xl border border-dashed border-border bg-[#faf8f4] px-5 py-8 text-center">
                  <p className="text-sm font-medium text-foreground">아직 등록된 질문이 없습니다.</p>
                  <p className="mt-1 text-sm text-muted">책을 읽고 질문을 만들면 World Smart에 자동으로 올라갑니다.</p>
                </div>
              ) : (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {worldSmartSummary.myQuestions.slice(0, 8).map((question) => {
                    const category = getWorldSmartCategoryMeta(question.questionType);

                    return (
                      <Link
                        key={question.id}
                        href={`/book/${question.bookId}/world-smart?tab=${question.questionType}&post=${question.id}`}
                        className="rounded-2xl border border-border bg-[#fcfaf7] px-4 py-4 transition-colors hover:border-foreground/30 hover:bg-white"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${category.chipClass}`}>
                            {category.icon} {category.label}
                          </span>
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            question.adoptedAnswerId
                              ? 'border border-amber-200 bg-amber-50 text-amber-700'
                              : 'border border-border bg-white text-muted'
                          }`}>
                            {question.adoptedAnswerId ? '채택 완료' : '답변 기다리는 중'}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm font-semibold text-foreground">{question.questionText}</p>
                        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
                          <span>{question.bookTitle ?? '책 정보 없음'}</span>
                          <span>{formatDate(question.createdAt)}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}

          {/* ── My stories (student only) ── */}
          {stats?.kind === 'student' && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="rounded-3xl border border-border/60 bg-white p-6 shadow-sm"
            >
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-heading font-semibold text-foreground">나의 서재</h2>
                  <p className="mt-1 text-sm text-muted">내가 만든 그림책을 한눈에 볼 수 있어요.</p>
                </div>
                {myStories.length > 0 && (
                  <Link
                    href="/library"
                    className="inline-flex items-center gap-1 text-sm font-medium text-secondary hover:text-secondary/80 transition-colors shrink-0"
                  >
                    전체 서재
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>

              {statsLoading ? (
                <div className="flex min-h-40 items-center justify-center">
                  <LoadingSpinner message="서재를 불러오는 중..." />
                </div>
              ) : myStories.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50/60 to-blue-50/60 border border-indigo-100/40 py-14 px-6 text-center">
                  <span className="text-5xl mb-4">📚</span>
                  <p className="text-sm text-muted mb-5">아직 만든 그림책이 없어요.</p>
                  <Link
                    href="/map"
                    className="inline-flex items-center rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-foreground/90 hover:shadow-md"
                  >
                    책 고르고 이야기 만들기
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {myStories.map((story, i) => {
                    const coverUrl =
                      story.cover_image_url ??
                      story.cover_design?.image_url ??
                      story.scene_images?.[0] ??
                      null;
                    const title = story.cover_design?.title ?? '나의 이야기';
                    const normalizedVisibility = normalizeStoryVisibility(story.visibility);
                    const visLabel = getStoryVisibilityLabel(normalizedVisibility);

                    return (
                      <motion.div
                        key={story.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 + i * 0.06 }}
                      >
                        <button
                          type="button"
                          onClick={() => handleMyStoryOpen(story)}
                          className="group text-left w-full"
                        >
                          <div className="relative overflow-hidden rounded-xl bg-muted-light/60 shadow-sm transition-all duration-300 group-hover:shadow-lg group-hover:-translate-y-1">
                            {coverUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={coverUrl}
                                alt={title}
                                className="aspect-[3/4] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="aspect-[3/4] w-full flex items-center justify-center bg-gradient-to-br from-indigo-100 to-blue-50">
                                <span className="text-4xl">📖</span>
                              </div>
                            )}
                            <span className={`absolute top-2 right-2 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
                              normalizedVisibility === 'public'
                                ? 'bg-emerald-500/80 text-white'
                                : 'bg-gray-500/80 text-white'
                            }`}>
                              {visLabel}
                            </span>
                          </div>
                          <div className="mt-2.5 px-0.5">
                            <p className="text-sm font-medium text-foreground truncate group-hover:text-secondary transition-colors">
                              {title}
                            </p>
                            <p className="text-xs text-muted mt-0.5">
                              {formatDate(story.created_at)}
                            </p>
                          </div>
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.section>
          )}
        </div>
      </main>

      {selectedMyStory && selectedMyStory.final_text && (
        <BookViewerModal
          key={storyViewerSession}
          isOpen={!!selectedMyStory}
          onClose={() => setSelectedMyStory(null)}
          pages={selectedMyStory.final_text}
          sceneImages={selectedMyStory.scene_images ?? []}
          translatedPages={selectedMyStory.translation_text ?? undefined}
          translatedPagesByLanguage={normalizeTranslatedTextsMap(
            selectedMyStory.translated_texts,
            selectedMyStory.translation_text,
            selectedMyStory.language
          )}
          comments={[]}
          canComment={false}
          commentLockMessage="내 서재 작품은 책처럼 다시 읽어볼 수 있어요."
          commentText=""
          onCommentChange={() => {}}
          onSubmitComment={() => {}}
          submittingComment={false}
          commentCount={0}
          storyFontFamily={getCoverTypographyFont(
            selectedMyStory.cover_design,
            selectedMyStory.illustration_style,
          ).fontFamily}
          storyFontSize={normalizeStorybookFontSize(selectedMyStory.cover_design?.story_font_size)}
        />
      )}
    </>
  );
}
