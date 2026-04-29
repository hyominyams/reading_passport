'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, Clock, Feather, RefreshCw, Send, Sparkles } from 'lucide-react';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import ToriQuestionCards from '@/components/story/ToriQuestionCards';
import ChatInput from '@/components/chat/ChatInput';
import { createClient } from '@/lib/supabase/client';
import { countries } from '@/lib/data/countries';
import { getStepRouteWithLang } from '@/lib/mystory-steps';
import { getToriCardSet, resolveToriActivityId } from '@/lib/tori-questions';
import { logClientError } from '@/lib/network-error';
import type { Book, DocentActivityRecommendation, StoryType } from '@/types/database';

/* ── Types ── */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

type MyStoryPhase = 'docent' | 'activity' | 'chat' | 'kicked';

interface DocentTypingState {
  timestamp: string;
  fullText: string;
  visibleText: string;
}

/* ── Constants ── */

const DOCENT_MAX_TURNS = 10;

const TYPE_LABELS: Record<StoryType, string> = {
  continue: '이야기 이어쓰기',
  new_protagonist: '주인공으로 새 이야기',
  extra_backstory: '엑스트라 뒷이야기',
  change_ending: '결말 바꾸기',
  custom: '기타',
};

const DOCENT_AVATAR = '✒️';
const DOCENT_TYPING_INTERVAL_MS = 28;

function getDocentTypingChunkSize(totalLength: number): number {
  if (totalLength > 180) return 3;
  if (totalLength > 80) return 2;
  return 1;
}

function normalizeGeneratedPages(payload: unknown): Array<{ draft: string; advice: string }> {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((page) => {
      if (typeof page === 'string') {
        const draft = page.trim();
        return draft ? { draft, advice: '' } : null;
      }

      if (!page || typeof page !== 'object') return null;

      const raw = page as Record<string, unknown>;
      const draft = typeof raw.draft === 'string' ? raw.draft.trim() : '';
      const advice = typeof raw.advice === 'string' ? raw.advice.trim() : '';

      if (!draft) return null;

      return { draft, advice };
    })
    .filter((page): page is { draft: string; advice: string } => page !== null);
}

function buildDocentGreeting(bookTitle: string): ChatMessage {
  return {
    role: 'assistant',
    content: `반가워. 나는 《${bookTitle}》을 쓴 도슨트야. 오늘은 내가 바빠서, 너와 열 번 정도 이야기를 나눌 수 있을 것 같아. 가장 궁금했던 장면이나 마음부터 천천히 이야기해 줘.`,
    timestamp: new Date().toISOString(),
  };
}

function serializeActivityInput(activity: DocentActivityRecommendation): string {
  return `${activity.title}: ${activity.starter}`.trim();
}

function getCountryDisplayName(countryId: string | null | undefined): string {
  if (!countryId) return '이 나라';
  const country = countries.find((item) => item.id === countryId);
  return country?.name ?? countryId;
}

function withResolvedActivityId(activity: DocentActivityRecommendation): DocentActivityRecommendation {
  const resolvedId = resolveToriActivityId(activity);
  if (!resolvedId || activity.id === resolvedId) return activity;
  return { ...activity, id: resolvedId };
}

/* ── Props ── */

interface MyStoryPageContentProps {
  book: Book;
  bookId: string;
  language: string;
  userId: string;
  storyId: string;
  initialStoryType: StoryType;
  initialCustomInput: string | null;
  initialDocentChatLog: ChatMessage[] | null;
  initialDocentRecommendations: DocentActivityRecommendation[] | null;
  initialSelectedActivity: DocentActivityRecommendation | null;
  initialCurrentStep: number;
  hasExistingDraft: boolean;
}

/* ── Component ── */

export default function MyStoryPageContent({
  book,
  bookId,
  language,
  userId,
  storyId,
  initialStoryType,
  initialCustomInput,
  initialDocentChatLog,
  initialDocentRecommendations,
  initialSelectedActivity,
  initialCurrentStep,
  hasExistingDraft,
}: MyStoryPageContentProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const docentMessagesRef = useRef<ChatMessage[]>([]);
  const docentBusyRef = useRef(false);

  // Determine initial phase: docent (chat) → activity (pick) → chat (Tori cards).
  // The 'chat' phase shows the Tori question cards once the student has
  // selected an activity. We resume there if a selected activity exists.
  const hasDocentRecommendations = initialDocentRecommendations != null && initialDocentRecommendations.length > 0;
  const hasSelectedActivity = initialSelectedActivity != null;
  const initialDocentMessages = initialDocentChatLog && initialDocentChatLog.length > 0
    ? initialDocentChatLog
    : [buildDocentGreeting(book.title)];

  const [phase, setPhase] = useState<MyStoryPhase>(
    hasSelectedActivity
      ? 'chat'
      : hasDocentRecommendations
        ? 'activity'
        : 'docent',
  );
  const [storyType, setStoryType] = useState<StoryType>(initialStoryType);
  const [customInput, setCustomInput] = useState<string | null>(initialCustomInput);
  const [selectedActivity, setSelectedActivity] = useState<DocentActivityRecommendation | null>(
    initialSelectedActivity,
  );
  const [docentMessages, setDocentMessages] = useState<ChatMessage[]>(initialDocentMessages);
  const [docentRecommendations, setDocentRecommendations] = useState<DocentActivityRecommendation[]>(
    initialDocentRecommendations ?? [],
  );
  const [docentFarewell, setDocentFarewell] = useState(
    hasDocentRecommendations
      ? '자, 그럼 이만 가볼게. 오늘 네가 나눈 이야기를 보니, 다음에는 이런 활동이 잘 어울리겠어.'
      : '',
  );
  const [customActivityInput, setCustomActivityInput] = useState('');
  const [docentResponding, setDocentResponding] = useState(false);
  const [docentTyping, setDocentTyping] = useState<DocentTypingState | null>(null);
  const [pendingDocentRecommendationMessages, setPendingDocentRecommendationMessages] = useState<ChatMessage[] | null>(null);
  const [recommendingActivities, setRecommendingActivities] = useState(false);
  const [selectingActivity, setSelectingActivity] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);

  const docentTurnCount = docentMessages.filter((m) => m.role === 'user').length;
  const docentRemainingTurns = Math.max(DOCENT_MAX_TURNS - docentTurnCount, 0);

  useEffect(() => {
    docentMessagesRef.current = docentMessages;
  }, [docentMessages]);

  useEffect(() => {
    if (!docentTyping) return;

    const fullChars = Array.from(docentTyping.fullText);
    const visibleLength = Array.from(docentTyping.visibleText).length;

    if (visibleLength >= fullChars.length) {
      const finishTimer = window.setTimeout(() => {
        setDocentTyping(null);
        docentBusyRef.current = false;
      }, 120);

      return () => window.clearTimeout(finishTimer);
    }

    const chunkSize = getDocentTypingChunkSize(fullChars.length);
    const nextText = fullChars.slice(0, visibleLength + chunkSize).join('');
    const typingTimer = window.setTimeout(() => {
      setDocentTyping((current) => {
        if (!current || current.timestamp !== docentTyping.timestamp) return current;
        return { ...current, visibleText: nextText };
      });
    }, DOCENT_TYPING_INTERVAL_MS);

    return () => window.clearTimeout(typingTimer);
  }, [docentTyping]);

  // Check DB connection on mount
  useEffect(() => {
    supabase
      .from('stories')
      .select('id')
      .eq('id', storyId)
      .single()
      .then(({ error: err }: { error: unknown }) => setDbConnected(!err))
      .catch(() => setDbConnected(false));
  }, [supabase, storyId]);

  // Auto-scroll to bottom of docent chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [
    docentMessages,
    docentTyping?.visibleText,
    pendingDocentRecommendationMessages,
    docentResponding,
    recommendingActivities,
    phase,
  ]);

  // Save docent session on beforeunload (tab close / navigate away)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const docentChatLog = docentMessagesRef.current;
      if (docentChatLog.length > 0) {
        const payload = JSON.stringify({ storyId, chatLog: [], docentChatLog });
        navigator.sendBeacon('/api/story/save-chat', payload);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [storyId]);

  const saveDocentLog = useCallback(
    async (msgs: ChatMessage[]) => {
      const { error: saveError } = await supabase
        .from('stories')
        .update({ docent_chat_log: msgs })
        .eq('id', storyId);

      if (saveError) {
        logClientError('Failed to save docent chat log:', saveError);
      }
    },
    [supabase, storyId],
  );

  // Flush docent log on unmount
  useEffect(() => {
    return () => {
      const docentChatLog = docentMessagesRef.current;
      if (docentChatLog.length > 0) {
        const payload = JSON.stringify({ storyId, chatLog: [], docentChatLog });
        navigator.sendBeacon('/api/story/save-chat', payload);
      }
    };
  }, [storyId]);

  /* ── Flag check: run after each student message ── */
  const checkForInappropriateContent = useCallback(
    async (
      msgs: ChatMessage[],
      characterName = '이야기 램프 토리',
    ): Promise<{ flagged: boolean; reason: string }> => {
      try {
        // Save snapshot to chat_logs first (so we have a record to flag)
        const chatMessages = msgs.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        }));

        const { data: inserted } = await supabase
          .from('chat_logs')
          .insert({
            student_id: userId,
            book_id: book.id,
            character_id: null,
            character_name: characterName,
            chat_type: 'story_gauge',
            messages: chatMessages,
            language,
            flagged: false,
          })
          .select('id')
          .single();

        if (!inserted) return { flagged: false, reason: '' };

        // Check content
        const res = await fetch('/api/chat/flag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatLogId: inserted.id,
            messages: chatMessages,
          }),
        });

        const data = await res.json();

        if (data.flagged) {
          // Keep the flagged snapshot in chat_logs (don't delete it)
          return { flagged: true, reason: data.reason ?? '' };
        }

        // Not flagged — delete the temporary snapshot
        await supabase.from('chat_logs').delete().eq('id', inserted.id);
        return { flagged: false, reason: '' };
      } catch {
        return { flagged: false, reason: '' };
      }
    },
    [supabase, userId, book.id, language],
  );

  /* ── Handle activity selection from docent recommendations ── */
  const handleActivitySelect = async (activity: DocentActivityRecommendation) => {
    if (selectingActivity) return;
    setError(null);
    setSelectingActivity(true);

    const activityForSave = withResolvedActivityId(activity);
    const nextCustomInput = serializeActivityInput(activityForSave);
    // Reset tori_answers when the activity changes so the new card set
    // starts blank instead of showing answers from a different activity.
    const previousActivityId = resolveToriActivityId(selectedActivity);
    const nextActivityId = resolveToriActivityId(activityForSave);
    const activityChanged = previousActivityId !== nextActivityId;

    setStoryType('custom');
    setCustomInput(nextCustomInput);
    setSelectedActivity(activityForSave);
    setPhase('chat');

    try {
      const update: Record<string, unknown> = {
        story_type: 'custom',
        custom_input: nextCustomInput,
        selected_activity: activityForSave,
        docent_chat_log: docentMessages,
        docent_recommendations: docentRecommendations,
        // Wipe legacy chat fields — Tori is now a question card flow.
        chat_log: [],
        all_student_messages: null,
      };
      if (activityChanged) {
        update.tori_answers = null;
      }

      const { error: dbErr } = await supabase
        .from('stories')
        .update(update)
        .eq('id', storyId);

      if (dbErr) throw dbErr;
    } catch (err) {
      logClientError('Failed to save selected activity:', err);
      setError('활동을 저장하지 못했어요. 질문을 마친 뒤 다시 저장할게요.');
    } finally {
      setSelectingActivity(false);
    }
  };

  const handleCustomActivitySubmit = async () => {
    const trimmed = customActivityInput.trim();
    if (!trimmed) {
      setError('하고 싶은 활동을 한 문장으로 적어 주세요.');
      return;
    }

    await handleActivitySelect({
      id: '_custom',
      title: '내가 정한 활동',
      description: trimmed,
      starter: trimmed,
    });
  };

  /* ── New session: reset everything to the docent greeting ── */
  const handleNewChat = () => {
    docentBusyRef.current = false;
    setDocentTyping(null);
    setPendingDocentRecommendationMessages(null);

    const freshDocentGreeting = buildDocentGreeting(book.title);

    supabase
      .from('stories')
      .update({
        chat_log: [],
        all_student_messages: null,
        story_type: 'continue',
        custom_input: null,
        docent_chat_log: [freshDocentGreeting],
        docent_recommendations: [],
        selected_activity: null,
        tori_answers: null,
      })
      .eq('id', storyId)
      .then(({ error: dbErr }: { error: unknown }) => {
        if (dbErr) logClientError('Failed to clear chat:', dbErr);
      });

    setDocentMessages([freshDocentGreeting]);
    setDocentRecommendations([]);
    setDocentFarewell('');
    setSelectedActivity(null);
    setCustomActivityInput('');
    setStoryType('continue');
    setCustomInput(null);
    setError(null);
    setDocentResponding(false);
    setRecommendingActivities(false);
    setSelectingActivity(false);
    setPhase('docent');
  };

  const requestDocentRecommendations = useCallback(
    async (msgs: ChatMessage[]) => {
      setRecommendingActivities(true);
      setError(null);

      try {
        const res = await fetch('/api/story/docent-recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            story_id: storyId,
            messages: msgs,
            book_id: book.id,
            book_title: book.title,
            language,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          farewell?: string;
          recommendations?: DocentActivityRecommendation[];
          error?: string;
        };

        if (!res.ok && !Array.isArray(data.recommendations)) {
          throw new Error(data.error || '활동 추천을 만들지 못했어요.');
        }

        const farewell = typeof data.farewell === 'string' && data.farewell.trim()
          ? data.farewell.trim()
          : '자, 그럼 이만 가볼게. 오늘 네가 나눈 이야기를 보니, 다음에는 이런 활동이 잘 어울리겠어.';
        const recommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
        const farewellMessage: ChatMessage = {
          role: 'assistant',
          content: farewell,
          timestamp: new Date().toISOString(),
        };
        const nextMessages = [...msgs, farewellMessage];

        setDocentMessages(nextMessages);
        setDocentFarewell(farewell);
        setDocentRecommendations(recommendations);
        setPhase('activity');
        await saveDocentLog(nextMessages);
      } catch (err) {
        logClientError('Docent recommendation error:', err);
        setError(err instanceof Error ? err.message : '활동 추천을 만들지 못했어요. 다시 시도해 주세요.');
      } finally {
        setRecommendingActivities(false);
      }
    },
    [book.id, book.title, language, saveDocentLog, storyId],
  );

  useEffect(() => {
    if (
      !pendingDocentRecommendationMessages
      || docentTyping
      || docentResponding
      || recommendingActivities
      || phase !== 'docent'
    ) return;

    const messagesForRecommendation = pendingDocentRecommendationMessages;
    setPendingDocentRecommendationMessages(null);
    void requestDocentRecommendations(messagesForRecommendation);
  }, [
    docentResponding,
    docentTyping,
    pendingDocentRecommendationMessages,
    phase,
    recommendingActivities,
    requestDocentRecommendations,
  ]);

  const handleDocentSend = async (text: string) => {
    if (
      docentBusyRef.current
      || docentResponding
      || recommendingActivities
      || docentTyping
      || pendingDocentRecommendationMessages
      || phase !== 'docent'
    ) return;
    docentBusyRef.current = true;
    setError(null);

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    const currentMsgs = [...docentMessages, userMsg];
    setDocentMessages(currentMsgs);
    void saveDocentLog(currentMsgs);

    checkForInappropriateContent(currentMsgs, '도슨트').then((result) => {
      if (result.flagged) {
        setPhase('kicked');
      }
    });

    const newTurnCount = currentMsgs.filter((message) => message.role === 'user').length;

    setDocentResponding(true);
    let startedTyping = false;
    try {
      const res = await fetch('/api/story/docent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMsgs.filter((message) => message.role !== 'system'),
          book_id: book.id,
          book_title: book.title,
          language,
          student_turn_count: newTurnCount,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || '도슨트의 답을 받지 못했어요.');
      }

      const reply = typeof data.reply === 'string' ? data.reply.trim() : '';
      if (!reply) {
        throw new Error('도슨트의 답이 비어 있어요.');
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };
      const nextMessages = [...currentMsgs, assistantMsg];

      setDocentMessages(nextMessages);
      startedTyping = true;
      setDocentTyping({
        timestamp: assistantMsg.timestamp,
        fullText: reply,
        visibleText: '',
      });
      if (newTurnCount >= DOCENT_MAX_TURNS) {
        setPendingDocentRecommendationMessages(nextMessages);
      }
      void saveDocentLog(nextMessages);
    } catch (err) {
      logClientError('Docent chat error:', err);
      setError('도슨트의 답을 받지 못했어요. 다시 시도해 주세요.');
    } finally {
      setDocentResponding(false);
      if (!startedTyping) {
        docentBusyRef.current = false;
      }
    }
  };

  /* ── Submit Tori card answers and generate draft ── */
  const handleToriSubmit = async (answers: Record<string, string>) => {
    if (!selectedActivity) {
      setError('먼저 활동을 골라주세요.');
      return;
    }

    setSubmitting(true);
    setError(null);

    const selectedActivityForSave = withResolvedActivityId(selectedActivity);
    const activityId = resolveToriActivityId(selectedActivityForSave) ?? '_custom';
    const toriPayload = { activity_id: activityId, answers };

    try {
      const { error: saveStoryError } = await supabase
        .from('stories')
        .update({
          docent_chat_log: docentMessages,
          docent_recommendations: docentRecommendations,
          selected_activity: selectedActivityForSave,
          tori_answers: toriPayload,
        })
        .eq('id', storyId);

      if (saveStoryError) throw saveStoryError;

      const draftRes = await fetch('/api/story/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          story_type: storyType,
          custom_input: customInput,
          selected_activity: selectedActivityForSave,
          docent_messages: docentMessages,
          tori_answers: toriPayload,
          language,
        }),
      });

      const draftData = (await draftRes.json().catch(() => ({}))) as {
        pages?: unknown;
        error?: string;
      };

      if (!draftRes.ok) {
        setError(draftData.error || '초안 생성에 실패했어요. 다시 시도해 주세요.');
        setSubmitting(false);
        return;
      }

      const generatedPages = normalizeGeneratedPages(draftData.pages);

      if (generatedPages.length === 0) {
        setError('초안 생성에 실패했어요. 다시 시도해 주세요.');
        setSubmitting(false);
        return;
      }

      const { error: draftSaveError } = await supabase
        .from('stories')
        .update({ ai_draft: generatedPages, current_step: 3 })
        .eq('id', storyId);

      if (draftSaveError) throw draftSaveError;

      router.push(getStepRouteWithLang(bookId, 3, storyId, language));
    } catch (err) {
      logClientError('Submit error:', err);
      setError('오류가 발생했어요. 다시 시도해 주세요.');
      setSubmitting(false);
    }
  };

  const handleSidebarStepSelect = async (targetStep: number) => {
    if (targetStep === 1) return;

    if (targetStep === 3) {
      if (hasExistingDraft) {
        const { error: updateError } = await supabase
          .from('stories')
          .update({ current_step: Math.max(initialCurrentStep, 3) })
          .eq('id', storyId);

        if (updateError) {
          setError('저장에 실패했어요. 다시 시도해 주세요.');
          return;
        }

        router.push(getStepRouteWithLang(bookId, 3, storyId, language));
        return;
      }

      setError('먼저 토리의 질문에 답하고 초안을 만들어 주세요.');
      return;
    }

    setError('지금은 다음 단계로 바로 이동할 수 없어요.');
  };

  /* ── Kicked screen ── */
  if (phase === 'kicked') {
    return (
      <main className="flex-1 flex items-center justify-center min-h-[60vh] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-sm text-center"
        >
          <div className="w-16 h-16 mx-auto mb-4 rounded-full border border-error/20 bg-error/10 flex items-center justify-center">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">대화가 중단되었어요</h2>
          <p className="text-sm leading-relaxed text-muted mb-6">
            수업과 관련 없는 내용이 감지되어 대화가 종료되었어요. 선생님께 알림이 전달되었습니다.
          </p>
          <button
            onClick={() => router.push(`/book/${bookId}/activity?lang=${language}`)}
            className="inline-flex items-center justify-center px-6 py-3 bg-foreground text-white rounded-xl text-sm font-bold shadow-sm hover:bg-foreground/90 transition-colors"
          >
            활동 페이지로 돌아가기
          </button>
        </motion.div>
      </main>
    );
  }

  /* ── Submitting screen ── */
  if (submitting) {
    return (
      <>
        <MyStoryStepSidebar
          currentStep={1}
          busy
          onStepSelect={handleSidebarStepSelect}
        />
        <main className="flex-1 flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 border-4 rounded-full border-muted-light border-t-primary animate-spin" />
            <div>
              <p className="text-lg font-bold text-foreground">이야기 초안을 만들고 있어요...</p>
              <p className="text-sm text-muted mt-1">이야기 램프 토리가 열심히 초안을 밝히고 있어! 잠깐만 기다려 줘 🌟</p>
            </div>
          </div>
        </main>
      </>
    );
  }

  /* ── Render ── */
  return (
    <>
      {(phase === 'chat' || phase === 'docent' || phase === 'activity') && (
        <MyStoryStepSidebar
          currentStep={1}
          busy={
            submitting
            || docentResponding
            || Boolean(docentTyping)
            || Boolean(pendingDocentRecommendationMessages)
            || recommendingActivities
            || selectingActivity
          }
          onStepSelect={handleSidebarStepSelect}
        />
      )}
      <main className="flex-1 min-h-0 flex flex-col">
      <AnimatePresence mode="wait">
        {phase === 'docent' ? (
          <motion.div
            key="docent-phase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col"
          >
            <div className="sticky top-14 z-20 bg-background/95 px-4 pb-3 pt-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-foreground/30 hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  처음부터
                </button>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted-light/70 px-3 py-1 text-[11px] font-semibold text-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {docentTurnCount}/{DOCENT_MAX_TURNS}
                </span>
              </div>
              <p className="mb-2 text-[11px] font-heading font-semibold uppercase tracking-[0.18em] text-muted">
                Step 4 · 그림책 작가와 대화
              </p>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="flex items-center gap-2 text-lg font-bold text-foreground">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-base">
                      {DOCENT_AVATAR}
                    </span>
                    작가 도슨트
                  </h1>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">
                    궁금했던 장면, 인물, 마음에 대해 이야기해 보세요.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-medium text-muted">
                  남은 대화 {docentRemainingTurns}회
                </span>
              </div>
              <div className="mt-3 h-px bg-border" />
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {docentMessages.map((msg, i) => {
                if (msg.role === 'assistant') {
                  const isTypingThisMessage = docentTyping?.timestamp === msg.timestamp;
                  const displayContent = isTypingThisMessage ? docentTyping.visibleText : msg.content;

                  return (
                    <motion.div
                      key={`${msg.timestamp}-${i}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex justify-start gap-2.5"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm shadow-sm">
                        {DOCENT_AVATAR}
                      </div>
                      <div className="max-w-[78%]">
                        <p className="ml-1 mb-1 text-[10px] font-semibold tracking-wide text-muted">작가 도슨트</p>
                        <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-sm">
                          <p
                            className="whitespace-pre-wrap break-words"
                            aria-live={isTypingThisMessage ? 'polite' : undefined}
                          >
                            {displayContent}
                            {isTypingThisMessage && (
                              <span className="ml-0.5 inline-block h-4 w-px translate-y-0.5 animate-pulse bg-foreground align-middle" />
                            )}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={`${msg.timestamp}-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-end"
                  >
                    <div className="max-w-[78%] rounded-2xl rounded-tr-md bg-foreground px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm">
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  </motion.div>
                );
              })}

              {(docentResponding || recommendingActivities) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start gap-2.5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm shadow-sm">
                    {DOCENT_AVATAR}
                  </div>
                  <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-foreground" />
                      {recommendingActivities ? '활동을 골라보고 있어요' : '작가님이 생각 중이에요'}
                    </div>
                  </div>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {error && (
              <div className="mx-4 mb-2 rounded-2xl border border-error/20 bg-error/5 px-4 py-2.5 text-sm font-medium text-error">
                {error}
              </div>
            )}

            <div className="border-t border-border bg-card">
              <ChatInput
                onSend={handleDocentSend}
                disabled={
                  docentResponding
                  || recommendingActivities
                  || Boolean(docentTyping)
                  || Boolean(pendingDocentRecommendationMessages)
                }
                placeholder="작가 도슨트에게 궁금한 점을 물어보세요..."
              />
            </div>
          </motion.div>
        ) : phase === 'activity' ? (
          <motion.div
            key="activity-phase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <span className="inline-flex items-center rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-[11px] font-heading font-semibold uppercase tracking-[0.18em] text-amber-700">
                  Step 4 · 다음 활동 추천
                </span>
                <h1 className="mt-3 text-2xl font-heading font-bold text-foreground sm:text-3xl">
                  이어갈 활동을 골라요
                </h1>
              </div>
              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                처음부터
              </button>
            </div>

            {/* Docent farewell as a styled speech bubble */}
            <div className="relative overflow-hidden rounded-2xl border border-amber-100/70 bg-gradient-to-br from-amber-50 via-white to-orange-50/40 p-5 shadow-sm">
              <div
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-200/30 blur-3xl"
              />
              <div className="relative flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-amber-200/60 bg-white text-lg shadow-sm">
                  {DOCENT_AVATAR}
                </div>
                <div className="min-w-0 pt-0.5">
                  <p className="text-[11px] font-heading font-semibold uppercase tracking-[0.18em] text-amber-700">
                    작가 도슨트
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                    {docentFarewell || '방금 우리가 나눈 이야기를 바탕으로, 이어갈 활동을 추천해 줄게.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Recommendation cards */}
            <div className="grid gap-4 md:grid-cols-3">
              {docentRecommendations.map((recommendation, index) => (
                <motion.button
                  key={`${recommendation.title}-${index}`}
                  type="button"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  onClick={() => void handleActivitySelect(recommendation)}
                  disabled={selectingActivity}
                  className="group relative flex min-h-60 flex-col overflow-hidden rounded-2xl border border-amber-100/60 bg-gradient-to-br from-white to-amber-50/30 p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-300/70 hover:shadow-lg hover:shadow-amber-900/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-amber-200/30 blur-2xl"
                  />

                  <div className="relative flex items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-400 text-white shadow-sm">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em] text-amber-700">
                      추천 {index + 1}
                    </span>
                  </div>

                  <h2 className="relative mt-3 text-base font-bold leading-snug text-foreground sm:text-lg">
                    {recommendation.title}
                  </h2>
                  <p className="relative mt-2 flex-1 text-sm leading-relaxed text-muted">
                    {recommendation.description}
                  </p>

                  {/* Starter as a quoted suggestion */}
                  <div className="relative mt-4 rounded-xl border-l-4 border-amber-300 bg-white/70 py-2.5 pl-3 pr-3 text-xs italic leading-relaxed text-foreground/80">
                    <span aria-hidden className="mr-0.5 text-amber-500">“</span>
                    {recommendation.starter}
                    <span aria-hidden className="ml-0.5 text-amber-500">”</span>
                  </div>

                  {/* CTA bar */}
                  <span className="relative mt-4 inline-flex items-center justify-between gap-2 rounded-xl bg-foreground/[0.04] px-3 py-2.5 text-sm font-semibold text-foreground transition-colors group-hover:bg-foreground group-hover:text-white">
                    <span className="flex items-center gap-1.5">
                      <Check className="h-4 w-4" />
                      이 활동으로 시작
                    </span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </motion.button>
              ))}
            </div>

            {/* Custom activity input */}
            <div className="rounded-2xl border border-amber-100/60 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-200/60 bg-white text-amber-600 shadow-sm">
                  <Feather className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground">내가 직접 정해 시작하기</p>
                  <p className="mt-0.5 text-xs text-muted">하고 싶은 활동을 한 문장으로 적어 주세요.</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={customActivityInput}
                  onChange={(event) => setCustomActivityInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleCustomActivitySubmit();
                  }}
                  placeholder="예: 인물 시점을 바꿔서 다시 써 보기"
                  className="min-w-0 flex-1 rounded-xl border border-amber-100/80 bg-white/90 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100"
                />
                <button
                  type="button"
                  onClick={() => void handleCustomActivitySubmit()}
                  disabled={selectingActivity || !customActivityInput.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-white shadow-md shadow-amber-900/15 transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  이걸로 시작
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-error/20 bg-error/5 px-4 py-2.5 text-sm font-medium text-error">
                {error}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="chat-phase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex w-full max-w-3xl mx-auto flex-1 flex-col"
          >
            <div className="sticky top-14 z-20 bg-background/95 px-4 pb-3 pt-4 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-foreground/30 hover:text-foreground"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  처음부터
                </button>
                <span className="min-w-0 max-w-[58%] truncate rounded-full border border-border bg-muted-light/70 px-3 py-1 text-[11px] font-semibold text-foreground">
                  {selectedActivity?.title
                    || (storyType === 'custom' && customInput ? customInput : TYPE_LABELS[storyType])}
                </span>
              </div>
              <p className="text-[11px] font-heading font-semibold uppercase tracking-[0.18em] text-muted">
                Step 4 · 토리의 질문
              </p>
            </div>

            {error && (
              <div className="mx-4 mt-2 rounded-2xl border border-error/20 bg-error/5 px-4 py-2.5 text-sm font-medium text-error">
                {error}
              </div>
            )}

            <div className="flex-1">
              <ToriQuestionCards
                storyId={storyId}
                cardSet={getToriCardSet(selectedActivity)}
                vars={{
                  country: getCountryDisplayName(book.country_id),
                  protagonist: undefined,
                }}
                submitting={submitting}
                onSubmit={handleToriSubmit}
                submitLabel={hasExistingDraft ? '저장하고 이미 만든 초안 보러 가기' : '이 답으로 그림책 초안 만들기'}
              />
            </div>

            <div className="flex justify-center pb-2">
              <span className="text-[10px] text-muted/70 flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${
                  dbConnected === null ? 'bg-border' : dbConnected ? 'bg-emerald-400' : 'bg-error'
                }`} />
                {dbConnected === null
                  ? '토리와 연결을 확인하고 있어요...'
                  : dbConnected
                    ? '토리와 연결되었어요'
                    : '토리와 연결이 끊겼어요'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </>
  );
}
