'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenText,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Globe2,
  MessageCircle,
  Search,
  Trash2,
  UserRound,
} from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  WORLD_SMART_CATEGORIES,
  getWorldSmartCategoryMeta,
  type WorldSmartManagedAnswerItem,
  type WorldSmartManagedPostItem,
  type WorldSmartManagementData,
} from '@/lib/world-smart';
import type { QuestionBoardCategory } from '@/types/database';

type ManagementMode = 'teacher' | 'admin';
type StatusFilter = 'all' | 'waiting' | 'adopted' | 'hidden';

interface WorldSmartManagementPanelProps {
  mode: ManagementMode;
}

const CATEGORY_ICON_MAP = {
  content: BookOpenText,
  character: UserRound,
  world: Globe2,
} satisfies Record<QuestionBoardCategory, typeof BookOpenText>;

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: '전체',
  waiting: '채택 대기',
  adopted: '채택 완료',
  hidden: '숨김 댓글',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

function getEndpoint(mode: ManagementMode) {
  return mode === 'teacher' ? '/api/teacher/world-smart' : '/api/admin/world-smart';
}

function getCategoryIcon(category: QuestionBoardCategory) {
  return CATEGORY_ICON_MAP[category];
}

export default function WorldSmartManagementPanel({ mode }: WorldSmartManagementPanelProps) {
  const endpoint = getEndpoint(mode);
  const [data, setData] = useState<WorldSmartManagementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('all');
  const [questionType, setQuestionType] = useState<QuestionBoardCategory | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [busyAnswerId, setBusyAnswerId] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(endpoint);
      const payload = await res.json() as WorldSmartManagementData | { error?: string };

      if (!res.ok) {
        throw new Error('error' in payload ? payload.error : '질문 게시판을 불러오지 못했습니다.');
      }

      setData(payload as WorldSmartManagementData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '질문 게시판을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return (data?.posts ?? []).filter((post) => {
      if (selectedBookId !== 'all' && post.bookId !== selectedBookId) {
        return false;
      }

      if (questionType !== 'all' && post.questionType !== questionType) {
        return false;
      }

      if (status === 'waiting' && post.adoptedAnswerId) {
        return false;
      }

      if (status === 'adopted' && !post.adoptedAnswerId) {
        return false;
      }

      if (status === 'hidden' && post.hiddenAnswerCount === 0) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [
        post.questionText,
        post.bookTitle,
        post.author.nickname,
        post.teacherName,
        post.className,
        ...post.answers.map((answer) => answer.content),
        ...post.answers.map((answer) => answer.author.nickname),
      ]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [data, query, questionType, selectedBookId, status]);

  useEffect(() => {
    if (filteredPosts.length === 0) {
      setSelectedPostId(null);
      return;
    }

    if (!selectedPostId || !filteredPosts.some((post) => post.id === selectedPostId)) {
      setSelectedPostId(filteredPosts[0].id);
    }
  }, [filteredPosts, selectedPostId]);

  const selectedPost = useMemo(() => {
    if (!selectedPostId) {
      return filteredPosts[0] ?? null;
    }

    return filteredPosts.find((post) => post.id === selectedPostId) ?? filteredPosts[0] ?? null;
  }, [filteredPosts, selectedPostId]);

  const totals = useMemo(() => {
    const posts = data?.posts ?? [];

    return {
      questions: posts.length,
      comments: posts.reduce((sum, post) => sum + post.visibleAnswerCount + post.hiddenAnswerCount, 0),
      hidden: posts.reduce((sum, post) => sum + post.hiddenAnswerCount, 0),
      waiting: posts.filter((post) => !post.adoptedAnswerId).length,
    };
  }, [data]);

  const handleModerate = async (
    answer: WorldSmartManagedAnswerItem,
    action: 'hide' | 'unhide' | 'delete',
  ) => {
    if (action === 'delete' && !window.confirm('댓글을 삭제할까요?')) {
      return;
    }

    setBusyAnswerId(answer.id);
    setError('');

    try {
      const res = await fetch(`${endpoint}/answers/${answer.id}`, {
        method: action === 'delete' ? 'DELETE' : 'PATCH',
        headers: action === 'delete' ? undefined : { 'Content-Type': 'application/json' },
        body: action === 'delete' ? undefined : JSON.stringify({ action }),
      });
      const payload = await res.json() as { error?: string };

      if (!res.ok) {
        throw new Error(payload.error ?? '댓글을 관리하지 못했습니다.');
      }

      await fetchBoard();
    } catch (err) {
      setError(err instanceof Error ? err.message : '댓글을 관리하지 못했습니다.');
    } finally {
      setBusyAnswerId(null);
    }
  };

  const renderPostCard = (post: WorldSmartManagedPostItem) => {
    const category = getWorldSmartCategoryMeta(post.questionType);
    const CategoryIcon = getCategoryIcon(post.questionType);
    const selected = selectedPost?.id === post.id;

    return (
      <button
        key={post.id}
        type="button"
        onClick={() => setSelectedPostId(post.id)}
        className={`w-full rounded-2xl border bg-white p-4 text-left transition-all hover:shadow-sm ${
          selected ? 'border-foreground ring-2 ring-foreground/10' : 'border-border'
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${category.chipClass}`}>
            <CategoryIcon className="h-3.5 w-3.5" />
            {category.label}
          </span>
          {post.hiddenAnswerCount > 0 && (
            <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700">
              숨김 {post.hiddenAnswerCount}
            </span>
          )}
          {post.adoptedAnswerId ? (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              채택
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-border bg-[#f8f5ef] px-2.5 py-1 text-[11px] font-semibold text-[#6d5e4c]">
              <Clock3 className="h-3.5 w-3.5" />
              대기
            </span>
          )}
        </div>
        <p className="mt-3 line-clamp-2 text-sm font-bold leading-6 text-foreground">{post.questionText}</p>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{post.author.nickname}</span>
          <span>{post.bookTitle ?? '도서'}</span>
          <span>댓글 {post.visibleAnswerCount + post.hiddenAnswerCount}</span>
          {mode === 'admin' && <span>{post.teacherName} · {post.className || '반 없음'}</span>}
        </div>
      </button>
    );
  };

  const renderDetail = () => {
    if (!selectedPost) {
      return (
        <div className="flex min-h-[460px] items-center justify-center rounded-3xl border border-dashed border-border bg-white px-6 text-center">
          <div>
            <MessageCircle className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 text-sm font-semibold text-foreground">질문을 선택하세요</p>
          </div>
        </div>
      );
    }

    const category = getWorldSmartCategoryMeta(selectedPost.questionType);
    const CategoryIcon = getCategoryIcon(selectedPost.questionType);

    return (
      <aside className="rounded-3xl border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${category.chipClass}`}>
              <CategoryIcon className="h-3.5 w-3.5" />
              {category.label}
            </span>
            <span className="rounded-full border border-border bg-[#f8f5ef] px-3 py-1 text-xs font-medium text-[#6d5e4c]">
              {selectedPost.author.nickname}
            </span>
          </div>
          <h3 className="mt-4 text-lg font-bold leading-7 text-foreground">{selectedPost.questionText}</h3>
          <p className="mt-2 text-xs text-muted">
            {selectedPost.bookTitle ?? '도서'} · {formatDate(selectedPost.createdAt)}
          </p>
          {mode === 'admin' && (
            <p className="mt-1 text-xs text-muted">
              {selectedPost.teacherName} · {selectedPost.className || '반 없음'}
            </p>
          )}
        </div>

        <div className="space-y-3 px-5 py-5">
          {selectedPost.answers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
              등록된 댓글이 없습니다.
            </div>
          ) : (
            selectedPost.answers.map((answer) => {
              const hidden = answer.moderationStatus === 'hidden';

              return (
                <article
                  key={answer.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    hidden
                      ? 'border-red-200 bg-red-50/70'
                      : answer.isAdopted
                        ? 'border-amber-300 bg-amber-50'
                        : 'border-border bg-[#fcfaf7]'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{answer.author.nickname}</p>
                        {answer.isAdopted && (
                          <span className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                            채택
                          </span>
                        )}
                        {hidden && (
                          <span className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-red-700">
                            숨김
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted">{formatDate(answer.updatedAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleModerate(answer, hidden ? 'unhide' : 'hide')}
                        disabled={busyAnswerId === answer.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-[#f7f2ea] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        {hidden ? '해제' : '숨김'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleModerate(answer, 'delete')}
                        disabled={busyAnswerId === answer.id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        삭제
                      </button>
                    </div>
                  </div>
                  <p className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${hidden ? 'text-red-950/75' : 'text-foreground'}`}>
                    {answer.content}
                  </p>
                  {hidden && answer.moderatedBy && (
                    <p className="mt-3 text-xs text-red-700">
                      {answer.moderatedBy.nickname} · {answer.moderatedAt ? formatDate(answer.moderatedAt) : ''}
                    </p>
                  )}
                </article>
              );
            })
          )}
        </div>
      </aside>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner message="질문 게시판을 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">질문 게시판 관리</h2>
          <p className="mt-1 text-sm text-muted">책을 선택하고 질문과 댓글을 관리하세요.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-2xl border border-border bg-[#fbf7ef] px-4 py-3">
            <p className="text-[11px] font-semibold text-[#8a6747]">질문</p>
            <p className="mt-1 text-xl font-bold text-foreground">{totals.questions}</p>
          </div>
          <div className="rounded-2xl border border-border bg-[#fbf7ef] px-4 py-3">
            <p className="text-[11px] font-semibold text-[#8a6747]">댓글</p>
            <p className="mt-1 text-xl font-bold text-foreground">{totals.comments}</p>
          </div>
          <div className="rounded-2xl border border-border bg-[#fbf7ef] px-4 py-3">
            <p className="text-[11px] font-semibold text-[#8a6747]">대기</p>
            <p className="mt-1 text-xl font-bold text-foreground">{totals.waiting}</p>
          </div>
          <div className="rounded-2xl border border-border bg-red-50 px-4 py-3">
            <p className="text-[11px] font-semibold text-red-700">숨김</p>
            <p className="mt-1 text-xl font-bold text-red-700">{totals.hidden}</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <section className="rounded-3xl border border-border bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_180px_180px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <span className="sr-only">검색</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="질문, 댓글, 학생 검색"
              className="w-full rounded-2xl border border-border bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition-colors focus:border-foreground"
            />
          </label>
          <select
            value={selectedBookId}
            onChange={(event) => setSelectedBookId(event.target.value)}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-sm font-medium text-foreground outline-none transition-colors focus:border-foreground"
          >
            <option value="all">전체 책</option>
            {(data?.books ?? []).map((book) => (
              <option key={book.id} value={book.id}>{book.title ?? '제목 없음'}</option>
            ))}
          </select>
          <select
            value={questionType}
            onChange={(event) => setQuestionType(event.target.value as QuestionBoardCategory | 'all')}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-sm font-medium text-foreground outline-none transition-colors focus:border-foreground"
          >
            <option value="all">전체 유형</option>
            {WORLD_SMART_CATEGORIES.map((category) => (
              <option key={category.key} value={category.key}>{category.label}</option>
            ))}
          </select>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
            className="rounded-2xl border border-border bg-white px-3 py-2.5 text-sm font-medium text-foreground outline-none transition-colors focus:border-foreground"
          >
            {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => (
              <option key={key} value={key}>{STATUS_LABELS[key]}</option>
            ))}
          </select>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)_420px]">
        <aside className="rounded-3xl border border-border bg-white p-3 shadow-sm">
          <button
            type="button"
            onClick={() => setSelectedBookId('all')}
            className={`mb-2 w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
              selectedBookId === 'all'
                ? 'bg-foreground text-white'
                : 'text-foreground hover:bg-[#f7f2ea]'
            }`}
          >
            전체 책
          </button>
          <div className="space-y-2">
            {(data?.books ?? []).map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => setSelectedBookId(book.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition-colors ${
                  selectedBookId === book.id
                    ? 'border-foreground bg-[#fbf7ef]'
                    : 'border-border bg-white hover:bg-[#f7f2ea]'
                }`}
              >
                <p className="line-clamp-2 text-sm font-bold leading-5 text-foreground">{book.title ?? '제목 없음'}</p>
                <p className="mt-2 text-xs text-muted">
                  질문 {book.questionCount} · 댓글 {book.visibleAnswerCount + book.hiddenAnswerCount}
                </p>
                {book.hiddenAnswerCount > 0 && (
                  <p className="mt-1 text-xs font-semibold text-red-700">숨김 {book.hiddenAnswerCount}</p>
                )}
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-3">
          {filteredPosts.length === 0 ? (
            <div className="rounded-3xl border border-border bg-white px-6 py-12 text-center">
              <p className="text-sm font-semibold text-foreground">표시할 질문이 없습니다.</p>
            </div>
          ) : (
            filteredPosts.map(renderPostCard)
          )}
        </section>

        <div className="xl:sticky xl:top-6 xl:self-start">
          {renderDetail()}
        </div>
      </div>
    </div>
  );
}
