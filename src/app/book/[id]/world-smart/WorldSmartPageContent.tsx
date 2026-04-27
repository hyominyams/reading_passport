'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpenText,
  CheckCircle2,
  Globe2,
  LockKeyhole,
  MessageCircle,
  PencilLine,
  Send,
  SlidersHorizontal,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import BackToActivity from '@/components/book/BackToActivity';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  WORLD_SMART_CATEGORIES,
  getWorldSmartCategoryMeta,
  isWorldSmartTabKey,
  type WorldSmartBoardData,
  type WorldSmartPostItem,
  type WorldSmartTabKey,
} from '@/lib/world-smart';
import type { QuestionBoardCategory } from '@/types/database';

type WorldSmartPageContentProps = {
  bookId: string;
  initialBookTitle: string;
  language: string;
};

type SortKey = 'latest' | 'popular' | 'waiting';

const QUICK_COMMENT_STARTERS = [
  '내 생각은 ',
  '다르게 생각하면 ',
  '더 궁금한 점은 ',
  '책에서 떠오른 장면은 ',
];

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'latest', label: '최신순' },
  { key: 'popular', label: '인기순' },
  { key: 'waiting', label: '채택 대기' },
];

const CATEGORY_ICON_MAP = {
  content: BookOpenText,
  character: UserRound,
  world: Globe2,
} satisfies Record<QuestionBoardCategory, typeof BookOpenText>;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

function getCategoryIcon(category: QuestionBoardCategory) {
  return CATEGORY_ICON_MAP[category];
}

export default function WorldSmartPageContent({
  bookId,
  initialBookTitle,
  language,
}: WorldSmartPageContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [board, setBoard] = useState<WorldSmartBoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingPostId, setSavingPostId] = useState<string | null>(null);
  const [adoptingKey, setAdoptingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(searchParams.get('post'));
  const [panelOpen, setPanelOpen] = useState(Boolean(searchParams.get('post')));
  const [sortKey, setSortKey] = useState<SortKey>('latest');

  const activeTab = isWorldSmartTabKey(searchParams.get('tab'))
    ? searchParams.get('tab')!
    : 'all';
  const highlightedPostId = searchParams.get('post');
  const showPostedBanner = searchParams.get('posted') === '1';

  const fetchBoard = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage(null);

      const res = await fetch(`/api/world-smart?bookId=${bookId}`);
      const data = await res.json() as WorldSmartBoardData | { error?: string };

      if (!res.ok) {
        throw new Error('error' in data ? data.error : 'World Smart를 불러오지 못했습니다.');
      }

      setBoard(data as WorldSmartBoardData);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'World Smart를 불러오지 못했습니다.';
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  }, [bookId]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  useEffect(() => {
    if (!board) {
      return;
    }

    setDrafts((prev) => {
      const next = { ...prev };

      for (const post of board.posts) {
        if (post.isMine) {
          continue;
        }

        const myAnswer = post.answers.find((answer) => answer.isMine);
        if (myAnswer && !next[post.id]) {
          next[post.id] = myAnswer.content;
        }
      }

      return next;
    });
  }, [board]);

  useEffect(() => {
    if (!highlightedPostId || !board) {
      return;
    }

    setSelectedPostId(highlightedPostId);
    setPanelOpen(true);
    const timer = window.setTimeout(() => {
      const target = document.getElementById(`world-smart-post-${highlightedPostId}`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [board, highlightedPostId]);

  const counts = useMemo(() => {
    const next: Record<WorldSmartTabKey, number> = {
      all: board?.posts.length ?? 0,
      content: 0,
      character: 0,
      world: 0,
    };

    for (const post of board?.posts ?? []) {
      next[post.questionType] += 1;
    }

    return next;
  }, [board]);

  const boardSummary = useMemo(() => ({
    waitingCount: board?.posts.filter((post) => !post.adoptedAnswerId).length ?? 0,
    adoptedCount: board?.posts.filter((post) => Boolean(post.adoptedAnswerId)).length ?? 0,
    commentCount: board?.posts.reduce((sum, post) => sum + post.answers.length, 0) ?? 0,
  }), [board]);

  const filteredPosts = useMemo(() => {
    if (!board) {
      return [];
    }

    if (activeTab === 'all') {
      return board.posts;
    }

    return board.posts.filter((post) => post.questionType === activeTab);
  }, [activeTab, board]);

  const sortedPosts = useMemo(() => {
    const posts = [...filteredPosts];

    if (sortKey === 'popular') {
      return posts.sort((left, right) => {
        const answerDiff = right.answers.length - left.answers.length;
        if (answerDiff !== 0) {
          return answerDiff;
        }

        const adoptedDiff = Number(Boolean(right.adoptedAnswerId)) - Number(Boolean(left.adoptedAnswerId));
        if (adoptedDiff !== 0) {
          return adoptedDiff;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
    }

    if (sortKey === 'waiting') {
      return posts.sort((left, right) => {
        const waitingDiff = Number(!right.adoptedAnswerId) - Number(!left.adoptedAnswerId);
        if (waitingDiff !== 0) {
          return waitingDiff;
        }

        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
    }

    return posts.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [filteredPosts, sortKey]);

  const selectedPost = useMemo(() => {
    if (!board || !selectedPostId) {
      return null;
    }

    const post = board.posts.find((item) => item.id === selectedPostId) ?? null;
    if (!post) {
      return null;
    }

    return filteredPosts.some((item) => item.id === post.id) ? post : null;
  }, [board, filteredPosts, selectedPostId]);

  const updateTab = (tab: typeof activeTab) => {
    const params = new URLSearchParams(searchParams.toString());

    if (tab === 'all') {
      params.delete('tab');
    } else {
      params.set('tab', tab);
    }

    params.delete('post');
    setPanelOpen(false);
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
  };

  const selectPost = (post: WorldSmartPostItem) => {
    setSelectedPostId(post.id);
    setPanelOpen(true);
  };

  const startEditing = (post: WorldSmartPostItem) => {
    setEditingPostId(post.id);
    setEditingText(post.questionText);
  };

  const cancelEditing = () => {
    setEditingPostId(null);
    setEditingText('');
  };

  const appendStarter = (postId: string, starter: string) => {
    setDrafts((prev) => {
      const current = prev[postId] ?? '';
      if (current.trim().length > 0) {
        return prev;
      }

      return {
        ...prev,
        [postId]: starter,
      };
    });
  };

  const handleAnswerSubmit = async (post: WorldSmartPostItem) => {
    const content = drafts[post.id]?.trim();
    if (!content) {
      setErrorMessage('댓글 내용을 입력해주세요.');
      return;
    }

    try {
      setSavingPostId(post.id);
      setErrorMessage(null);

      const res = await fetch(`/api/world-smart/posts/${post.id}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? '댓글을 저장하지 못했습니다.');
      }

      await fetchBoard();
    } catch (error) {
      const message = error instanceof Error ? error.message : '댓글을 저장하지 못했습니다.';
      setErrorMessage(message);
    } finally {
      setSavingPostId(null);
    }
  };

  const handleQuestionUpdate = async (postId: string) => {
    const questionText = editingText.trim();
    if (!questionText) {
      setErrorMessage('질문 내용을 입력해주세요.');
      return;
    }

    try {
      setSavingPostId(postId);
      setErrorMessage(null);

      const res = await fetch(`/api/world-smart/posts/${postId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionText }),
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? '질문을 수정하지 못했습니다.');
      }

      cancelEditing();
      await fetchBoard();
    } catch (error) {
      const message = error instanceof Error ? error.message : '질문을 수정하지 못했습니다.';
      setErrorMessage(message);
    } finally {
      setSavingPostId(null);
    }
  };

  const handleQuestionDelete = async (postId: string) => {
    if (!window.confirm('질문을 삭제할까요? 댓글도 함께 삭제됩니다.')) {
      return;
    }

    try {
      setDeletingPostId(postId);
      setErrorMessage(null);

      const res = await fetch(`/api/world-smart/posts/${postId}`, {
        method: 'DELETE',
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? '질문을 삭제하지 못했습니다.');
      }

      if (editingPostId === postId) {
        cancelEditing();
      }
      await fetchBoard();
    } catch (error) {
      const message = error instanceof Error ? error.message : '질문을 삭제하지 못했습니다.';
      setErrorMessage(message);
    } finally {
      setDeletingPostId(null);
    }
  };

  const handleAdopt = async (postId: string, answerId: string) => {
    try {
      setAdoptingKey(`${postId}:${answerId}`);
      setErrorMessage(null);

      const res = await fetch(`/api/world-smart/posts/${postId}/adopt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerId }),
      });
      const data = await res.json() as { error?: string };

      if (!res.ok) {
        throw new Error(data.error ?? '댓글을 채택하지 못했습니다.');
      }

      await fetchBoard();
    } catch (error) {
      const message = error instanceof Error ? error.message : '댓글을 채택하지 못했습니다.';
      setErrorMessage(message);
    } finally {
      setAdoptingKey(null);
    }
  };

  const CommentPanel = ({
    post,
    onClose,
  }: {
    post: WorldSmartPostItem | null;
    onClose?: () => void;
  }) => {
    if (!post) {
      return (
        <div className="flex h-full min-h-[420px] items-center justify-center rounded-[28px] border border-dashed border-border bg-white px-6 text-center">
          <div>
            <MessageCircle className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-3 text-sm font-semibold text-foreground">질문을 선택하세요</p>
            <p className="mt-1 text-sm text-muted">질문을 고르면 댓글이 열립니다.</p>
          </div>
        </div>
      );
    }

    const category = getWorldSmartCategoryMeta(post.questionType);
    const CategoryIcon = getCategoryIcon(post.questionType);
    const hasAdoptedAnswer = Boolean(post.adoptedAnswerId);
    const myAnswerLabel = post.myAnswerId ? '댓글 저장' : '댓글 보내기';

    return (
      <aside className="flex h-full min-h-[520px] flex-col overflow-hidden rounded-[28px] border border-border bg-white shadow-sm">
        <div className="border-b border-border px-5 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${category.chipClass}`}>
                  <CategoryIcon className="h-3.5 w-3.5" />
                  {category.label}
                </span>
                <span className="rounded-full border border-border bg-[#f8f5ef] px-3 py-1 text-xs font-medium text-[#6d5e4c]">
                  {post.isMine ? '내 질문' : post.author.nickname}
                </span>
                {hasAdoptedAnswer && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    채택 완료
                  </span>
                )}
              </div>

              {editingPostId === post.id ? (
                <div className="mt-4 space-y-3">
                  <textarea
                    value={editingText}
                    onChange={(event) => setEditingText(event.target.value)}
                    rows={4}
                    className="w-full resize-none rounded-2xl border border-border bg-[#fcfaf7] px-4 py-3 text-sm font-medium leading-6 text-foreground outline-none transition-colors focus:border-foreground"
                  />
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-[#f7f2ea]"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleQuestionUpdate(post.id)}
                      disabled={savingPostId === post.id}
                      className="rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {savingPostId === post.id ? '저장 중...' : '질문 저장'}
                    </button>
                  </div>
                </div>
              ) : (
                <h2 className="mt-4 text-xl font-bold leading-8 text-foreground">{post.questionText}</h2>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {post.isMine && !hasAdoptedAnswer && editingPostId !== post.id && (
                <>
                  <button
                    type="button"
                    onClick={() => startEditing(post)}
                    className="rounded-full border border-border bg-white p-2 text-muted transition-colors hover:text-foreground"
                    title="질문 수정"
                    aria-label="질문 수정"
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQuestionDelete(post.id)}
                    disabled={deletingPostId === post.id}
                    className="rounded-full border border-red-200 bg-white p-2 text-red-500 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title="질문 삭제"
                    aria-label="질문 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-border bg-white p-2 text-muted transition-colors hover:text-foreground"
                  title="닫기"
                  aria-label="닫기"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <p className="mt-3 text-xs font-medium text-muted">
            {formatDate(post.createdAt)} · 댓글 {post.answers.length}개
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {post.answers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-[#fcfaf7] px-4 py-8 text-center">
              <MessageCircle className="mx-auto h-7 w-7 text-muted" />
              <p className="mt-3 text-sm font-semibold text-foreground">첫 댓글을 기다리고 있어요</p>
            </div>
          ) : (
            <div className="space-y-3">
              {post.answers.map((answer) => (
                <article
                  key={answer.id}
                  className={`rounded-2xl border px-4 py-4 ${
                    answer.isAdopted
                      ? 'border-amber-300 bg-amber-50'
                      : 'border-border bg-[#fcfaf7]'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-base shadow-sm">
                        {answer.author.avatarEmoji ?? '🙂'}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {answer.isMine ? '내 댓글' : answer.author.nickname}
                        </p>
                        <p className="text-xs text-muted">{formatDate(answer.updatedAt)}</p>
                      </div>
                    </div>

                    {answer.isAdopted ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-700">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        채택
                      </span>
                    ) : post.isMine && !hasAdoptedAnswer ? (
                      <button
                        type="button"
                        onClick={() => void handleAdopt(post.id, answer.id)}
                        disabled={adoptingKey === `${post.id}:${answer.id}`}
                        className="rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {adoptingKey === `${post.id}:${answer.id}` ? '채택 중...' : '채택'}
                      </button>
                    ) : null}
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{answer.content}</p>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border bg-[#faf8f4] px-5 py-4">
          {post.isMine ? (
            <div className="rounded-2xl border border-[#e7dccd] bg-white px-4 py-4 text-sm leading-6 text-[#6d5e4c]">
              {hasAdoptedAnswer
                ? '채택이 끝난 질문입니다.'
                : '마음에 드는 댓글을 채택할 수 있습니다.'}
            </div>
          ) : hasAdoptedAnswer ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
                  <LockKeyhole className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-amber-800">채택이 끝난 질문입니다.</p>
                  <p className="mt-1 text-sm leading-6 text-amber-700">새 댓글은 받을 수 없습니다.</p>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex flex-wrap gap-2">
                {QUICK_COMMENT_STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => appendStarter(post.id, starter)}
                    className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-[#6d5e4c] transition-colors hover:bg-[#f4ede3]"
                  >
                    {starter.trim()}
                  </button>
                ))}
              </div>
              <label className="sr-only" htmlFor={`world-smart-answer-${post.id}`}>
                내 생각 쓰기
              </label>
              <textarea
                id={`world-smart-answer-${post.id}`}
                value={drafts[post.id] ?? ''}
                onChange={(event) =>
                  setDrafts((prev) => ({ ...prev, [post.id]: event.target.value }))
                }
                rows={4}
                placeholder="내 생각 쓰기"
                className="w-full resize-none rounded-2xl border border-border bg-white px-4 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted/70 focus:border-foreground"
              />
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleAnswerSubmit(post)}
                  disabled={savingPostId === post.id}
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" />
                  {savingPostId === post.id ? '저장 중...' : myAnswerLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-foreground">World Smart</h1>
          <p className="mt-1 text-sm text-muted">
            {board?.bookTitle ?? initialBookTitle} 질문을 고르고 댓글을 남겨요.
          </p>
        </div>
        <div className="shrink-0 pt-1">
          <BackToActivity bookId={bookId} language={language} />
        </div>
      </div>

      <section className="rounded-[28px] border border-border bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#e5dac8] bg-[#fbf7ef] px-4 py-4">
            <p className="text-xs font-semibold text-[#8a6747]">질문</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{counts.all}</p>
          </div>
          <div className="rounded-2xl border border-[#e5dac8] bg-[#fbf7ef] px-4 py-4">
            <p className="text-xs font-semibold text-[#8a6747]">댓글</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{boardSummary.commentCount}</p>
          </div>
          <div className="rounded-2xl border border-[#e5dac8] bg-[#fbf7ef] px-4 py-4">
            <p className="text-xs font-semibold text-[#8a6747]">채택 대기</p>
            <p className="mt-2 text-2xl font-bold text-foreground">{boardSummary.waitingCount}</p>
          </div>
        </div>
      </section>

      {showPostedBanner && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
          <p className="text-sm font-semibold text-emerald-800">질문이 World Smart에 올라왔어요.</p>
          <p className="mt-1 text-sm text-emerald-700">친구들의 댓글을 기다려 보세요.</p>
        </div>
      )}

      <section className="rounded-3xl border border-border bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => updateTab('all')}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === 'all'
                  ? 'bg-foreground text-white'
                  : 'border border-border bg-white text-muted hover:text-foreground'
              }`}
            >
              <MessageCircle className="h-4 w-4" />
              전체 {counts.all}
            </button>
            {WORLD_SMART_CATEGORIES.map((category) => {
              const CategoryIcon = getCategoryIcon(category.key);

              return (
                <button
                  key={category.key}
                  type="button"
                  onClick={() => updateTab(category.key)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    activeTab === category.key
                      ? 'bg-foreground text-white'
                      : `${category.chipClass} hover:opacity-90`
                  }`}
                >
                  <CategoryIcon className="h-4 w-4" />
                  {category.label} {counts[category.key]}
                </button>
              );
            })}
          </div>

          <div className="flex shrink-0 items-center gap-2 overflow-x-auto rounded-full border border-border bg-[#faf8f4] p-1">
            <span className="inline-flex shrink-0 items-center gap-1.5 px-2 text-xs font-semibold text-muted">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              정렬
            </span>
            {SORT_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setSortKey(option.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  sortKey === option.key
                    ? 'bg-foreground text-white shadow-sm'
                    : 'text-[#6d5e4c] hover:bg-white hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-60 items-center justify-center rounded-3xl border border-border bg-white">
          <LoadingSpinner message="질문게시판을 불러오는 중..." />
        </div>
      ) : sortedPosts.length === 0 ? (
        <div className="rounded-3xl border border-border bg-white px-6 py-12 text-center">
          <p className="text-lg font-semibold text-foreground">아직 올라온 질문이 없습니다.</p>
          <p className="mt-2 text-sm text-muted">질문 만들기를 완료하면 이 책의 World Smart 게시판이 열립니다.</p>
        </div>
      ) : (
        <div className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sortedPosts.map((post, index) => {
            const category = getWorldSmartCategoryMeta(post.questionType);
            const CategoryIcon = getCategoryIcon(post.questionType);
            const hasHighlight = highlightedPostId === post.id;
            const hasAdoptedAnswer = Boolean(post.adoptedAnswerId);
            const isSelected = panelOpen && selectedPost?.id === post.id;

            return (
              <motion.button
                key={post.id}
                id={`world-smart-post-${post.id}`}
                type="button"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => selectPost(post)}
                className={`group relative min-h-[168px] rounded-[24px] border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                  hasHighlight || isSelected ? 'border-foreground ring-2 ring-foreground/10' : 'border-border'
                }`}
              >
                <div className={`absolute inset-y-4 left-0 w-1.5 rounded-r-full ${category.accentClass.replace('text-', 'bg-')}`} />
                <div className="flex items-start justify-between gap-3 pl-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${category.chipClass}`}>
                    <CategoryIcon className="h-3.5 w-3.5" />
                    {category.label}
                  </span>
                  {hasAdoptedAnswer ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      채택
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-[#f8f5ef] px-2.5 py-1 text-[11px] font-semibold text-[#6d5e4c]">
                      대기
                    </span>
                  )}
                </div>

                <h2 className="mt-4 line-clamp-3 pl-2 text-base font-bold leading-7 text-foreground">
                  {post.questionText}
                </h2>

                <div className="mt-4 flex items-center justify-between gap-3 pl-2 text-xs text-muted">
                  <span className="min-w-0 truncate">
                    {post.isMine ? '내 질문' : post.author.nickname}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-foreground">
                    <MessageCircle className="h-3.5 w-3.5" />
                    {post.answers.length}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {panelOpen && selectedPost && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 px-3 py-4"
            onClick={() => setPanelOpen(false)}
          >
            <motion.div
              initial={{ x: 56, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 56, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="ml-auto h-full w-full max-w-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <CommentPanel post={selectedPost} onClose={() => setPanelOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
