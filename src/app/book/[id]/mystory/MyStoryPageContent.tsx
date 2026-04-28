'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Clock, Feather, RefreshCw, Send, Sparkles } from 'lucide-react';
import MyStoryStepSidebar from '@/components/story/MyStoryStepSidebar';
import ChatInput from '@/components/chat/ChatInput';
import { createClient } from '@/lib/supabase/client';
import { getDetailStepProgressLabel, getStepRouteWithLang } from '@/lib/mystory-steps';
import type { Book, DocentActivityRecommendation, StoryType } from '@/types/database';

/* ── Types ── */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

type MyStoryPhase = 'docent' | 'activity' | 'chat' | 'kicked';

interface ValidationResult {
  character: boolean;
  setting: boolean;
  conflict: boolean;
  ending: boolean;
  pass: boolean;
  feedback: string;
  missing_fields: Array<'character' | 'setting' | 'conflict' | 'ending'>;
  feedback_lines: string[];
  retry_prompt: string;
}

interface ValidationNotice {
  status: 'success' | 'needs_more';
  title: string;
  lines: string[];
  retryPrompt?: string;
}

/* ── Constants ── */

const REVALIDATE_INTERVAL = 3;
const DOCENT_MAX_TURNS = 10;

const TYPE_LABELS: Record<StoryType, string> = {
  continue: '이야기 이어쓰기',
  new_protagonist: '주인공으로 새 이야기',
  extra_backstory: '엑스트라 뒷이야기',
  change_ending: '결말 바꾸기',
  custom: '기타',
};

const TORI_AVATAR = '🪔';
const DOCENT_AVATAR = '✒️';
const CHAT_FALLBACK_REPLY = '오호, 그 이야기를 조금만 더 또렷하게 들려주면 좋겠어.';
const DOCENT_FALLBACK_REPLY =
  '그 질문은 이 책을 깊이 보는 질문이야. 나는 그 장면에서 인물의 두려움, 선택, 용기를 함께 생각해 보게 하고 싶었어. 이 생각은 어려운 순간에 어떻게 행동할지 고르는 인물이라는 이야기 씨앗이 될 수 있어. 다음에는 다른 인물, 장면, 결말, 네 그림책 아이디어 중에서 궁금한 걸 골라 물어봐도 좋아.';

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

function pickFocusField(result: ValidationResult): 'character' | 'conflict' | 'setting' | 'ending' | null {
  if (result.missing_fields.length > 0) {
    const [firstMissingField] = result.missing_fields;
    if (firstMissingField === 'character' || firstMissingField === 'conflict' || firstMissingField === 'setting' || firstMissingField === 'ending') {
      return firstMissingField;
    }
  }

  if (!result.character) return 'character';
  if (!result.conflict) return 'conflict';
  if (!result.setting) return 'setting';
  if (!result.ending) return 'ending';
  return null;
}

function buildDocentGreeting(bookTitle: string): ChatMessage {
  return {
    role: 'assistant',
    content: `반가워. 나는 《${bookTitle}》을 쓴 도슨트야. 오늘은 내가 바빠서, 너와 열 번 정도 이야기를 나눌 수 있을 것 같아. 가장 궁금했던 것부터 천천히 물어봐.`,
    timestamp: new Date().toISOString(),
  };
}

function serializeActivityInput(activity: DocentActivityRecommendation): string {
  return `${activity.title}: ${activity.starter}`.trim();
}

function buildToriGreeting(activity: DocentActivityRecommendation | null, customInput: string | null): string {
  const activityTitle = activity?.title || customInput || '네가 고른 활동';
  const starter = activity?.starter || customInput || '';
  const starterLine = starter ? `\n\n시작 문장: ${starter}` : '';

  return `안녕! 나는 이야기 램프 토리야 ${TORI_AVATAR}\n\n도슨트와 고른 "${activityTitle}"로 시작해볼게. 어떤 이야기를 쓰고 싶은지 들려줘.${starterLine}`;
}

function getMissingFieldLabel(field: 'character' | 'setting' | 'conflict' | 'ending'): string {
  switch (field) {
    case 'character':
      return '인물';
    case 'setting':
      return '배경';
    case 'conflict':
      return '사건';
    case 'ending':
      return '결말';
    default:
      return '이야기';
  }
}

function buildRetryAssistantMessage(result: ValidationResult): string {
  const labels = result.missing_fields.slice(0, 2).map(getMissingFieldLabel);
  const missingText = labels.length > 0 ? labels.join(', ') : '이야기 재료';
  return `오호, 여기까지도 흥미로운 이야기인걸. ${missingText} 쪽을 조금 더 들려주면 더 탄탄해질 것 같아. 두 가지 정도만 더 들려줄래?`;
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
  requiredTurns: number;
  hasExistingDraft: boolean;
  initialChatLog: ChatMessage[] | null;
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
  requiredTurns,
  hasExistingDraft,
  initialChatLog,
}: MyStoryPageContentProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const firstValidateAt = Math.max(3, requiredTurns);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const docentMessagesRef = useRef<ChatMessage[]>([]);
  const pendingChatLogRef = useRef<ChatMessage[] | null>(null);
  const docentBusyRef = useRef(false);

  // Determine initial state
  const hasChatHistory = initialChatLog != null && initialChatLog.length > 0;
  const hasDocentRecommendations = initialDocentRecommendations != null && initialDocentRecommendations.length > 0;
  const initialDocentMessages = initialDocentChatLog && initialDocentChatLog.length > 0
    ? initialDocentChatLog
    : [buildDocentGreeting(book.title)];

  const [phase, setPhase] = useState<MyStoryPhase>(
    hasChatHistory
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
      ? '이제 헤어질 시간이야. 오늘 네가 나눈 이야기를 보니, 다음에는 이런 활동이 잘 어울리겠어.'
      : '',
  );
  const [customActivityInput, setCustomActivityInput] = useState('');
  const [docentResponding, setDocentResponding] = useState(false);
  const [recommendingActivities, setRecommendingActivities] = useState(false);
  const [selectingActivity, setSelectingActivity] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (hasChatHistory) return initialChatLog;
    return [];
  });
  const [responding, setResponding] = useState(false);

  // Validation state
  const [validated, setValidated] = useState(() => {
    if (!initialChatLog || initialChatLog.length === 0) return false;
    return initialChatLog.some(
      (m) => m.role === 'assistant' && m.content.includes('이야기 재료가 충분히 모였어'),
    );
  });
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dbConnected, setDbConnected] = useState<boolean | null>(null);
  const [validationNotice, setValidationNotice] = useState<ValidationNotice | null>(null);

  // Count student turns
  const studentTurnCount = messages.filter((m) => m.role === 'user').length;
  const docentTurnCount = docentMessages.filter((m) => m.role === 'user').length;
  const docentRemainingTurns = Math.max(DOCENT_MAX_TURNS - docentTurnCount, 0);

  // Keep messagesRef in sync for beforeunload
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    docentMessagesRef.current = docentMessages;
  }, [docentMessages]);

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

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, docentMessages, validating, docentResponding, recommendingActivities, phase]);

  // Save session on beforeunload (tab close / navigate away)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const chatLog = messagesRef.current;
      const docentChatLog = docentMessagesRef.current;
      if (chatLog.length > 0 || docentChatLog.length > 0) {
        const payload = JSON.stringify({ storyId, chatLog, docentChatLog });
        navigator.sendBeacon('/api/story/save-chat', payload);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [storyId]);

  /* ── Save chat_log to DB (debounced) ── */
  const saveChatLog = useCallback(
    (msgs: ChatMessage[]) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      pendingChatLogRef.current = msgs;
      saveTimerRef.current = setTimeout(async () => {
        try {
          const { error: saveError } = await supabase
            .from('stories')
            .update({ chat_log: msgs })
            .eq('id', storyId);

          if (saveError) {
            throw saveError;
          }

          if (pendingChatLogRef.current === msgs) {
            pendingChatLogRef.current = null;
          }
        } catch (err) {
          console.error('Failed to save chat log:', err);
        }
      }, 800);
    },
    [supabase, storyId],
  );

  const saveDocentLog = useCallback(
    async (msgs: ChatMessage[]) => {
      const { error: saveError } = await supabase
        .from('stories')
        .update({ docent_chat_log: msgs })
        .eq('id', storyId);

      if (saveError) {
        console.error('Failed to save docent chat log:', saveError);
      }
    },
    [supabase, storyId],
  );

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }

      const chatLog = pendingChatLogRef.current ?? messagesRef.current;
      const docentChatLog = docentMessagesRef.current;
      if (chatLog.length > 0 || docentChatLog.length > 0) {
        const payload = JSON.stringify({ storyId, chatLog, docentChatLog });
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

    const nextCustomInput = serializeActivityInput(activity);
    setStoryType('custom');
    setCustomInput(nextCustomInput);
    setSelectedActivity(activity);

    const greeting: ChatMessage = {
      role: 'assistant',
      content: buildToriGreeting(activity, nextCustomInput),
      timestamp: new Date().toISOString(),
    };

    setMessages([greeting]);
    setValidated(false);
    setValidationNotice(null);

    try {
      const { error: dbErr } = await supabase
        .from('stories')
        .update({
          story_type: 'custom',
          custom_input: nextCustomInput,
          selected_activity: activity,
          docent_chat_log: docentMessages,
          docent_recommendations: docentRecommendations,
          chat_log: [greeting],
          all_student_messages: null,
        })
        .eq('id', storyId);

      if (dbErr) throw dbErr;

      setPhase('chat');
    } catch (err) {
      console.error('Failed to save selected activity:', err);
      setError('활동 선택을 저장하지 못했어요. 다시 시도해 주세요.');
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
      title: '내가 정한 활동',
      description: trimmed,
      starter: trimmed,
    });
  };

  /* ── New chat: reset session ── */
  const handleNewChat = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    messagesRef.current = [];
    docentBusyRef.current = false;

    const freshDocentGreeting = buildDocentGreeting(book.title);

    // Clear Step 4 conversation state from DB
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
      })
      .eq('id', storyId)
      .then(({ error: dbErr }: { error: unknown }) => {
        if (dbErr) console.error('Failed to clear chat:', dbErr);
      });

    setMessages([]);
    setDocentMessages([freshDocentGreeting]);
    setDocentRecommendations([]);
    setDocentFarewell('');
    setSelectedActivity(null);
    setCustomActivityInput('');
    setStoryType('continue');
    setCustomInput(null);
    setValidated(false);
    setValidationNotice(null);
    setError(null);
    setDocentResponding(false);
    setRecommendingActivities(false);
    setSelectingActivity(false);
    setPhase('docent');
  };

  /* ── Run validation ── */
  const runValidation = useCallback(
    async (msgs: ChatMessage[]): Promise<ValidationResult> => {
      const studentMessages = msgs
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n');

      try {
        const res = await fetch('/api/story/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ all_student_messages: studentMessages }),
        });
        const data = await res.json();
        return {
          character: data.character === true,
          setting: data.setting === true,
          conflict: data.conflict === true,
          ending: data.ending === true,
          pass: data.pass === true,
          feedback: typeof data.feedback === 'string' ? data.feedback : '',
          missing_fields: Array.isArray(data.missing_fields)
            ? data.missing_fields.filter((field: unknown) =>
              field === 'character' || field === 'setting' || field === 'conflict' || field === 'ending')
            : [],
          feedback_lines: Array.isArray(data.feedback_lines)
            ? data.feedback_lines.filter((line: unknown): line is string => typeof line === 'string')
            : [],
          retry_prompt: typeof data.retry_prompt === 'string' ? data.retry_prompt : '',
        };
      } catch {
        return {
          character: false,
          setting: false,
          conflict: false,
          ending: false,
          pass: false,
          feedback: '',
          missing_fields: ['character', 'setting', 'conflict', 'ending'],
          feedback_lines: [
            '지금은 이야기 재료를 제대로 확인하지 못했어.',
            '중요한 인물과 사건이 보이게 조금만 더 들려줘.',
          ],
          retry_prompt: '좋아, 두 가지 정도만 더 들려줄래?',
        };
      }
    },
    [],
  );

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
          : '이제 헤어질 시간이야. 오늘 네가 나눈 이야기를 보니, 다음에는 이런 활동이 잘 어울리겠어.';
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
        console.error('Docent recommendation error:', err);
        setError(err instanceof Error ? err.message : '활동 추천을 만들지 못했어요. 다시 시도해 주세요.');
      } finally {
        setRecommendingActivities(false);
      }
    },
    [book.id, book.title, language, saveDocentLog, storyId],
  );

  const handleDocentSend = async (text: string) => {
    if (docentBusyRef.current || docentResponding || recommendingActivities || phase !== 'docent') return;
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

    if (newTurnCount >= DOCENT_MAX_TURNS) {
      try {
        await requestDocentRecommendations(currentMsgs);
      } finally {
        docentBusyRef.current = false;
      }
      return;
    }

    setDocentResponding(true);
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

      const data = (await res.json().catch(() => ({}))) as { reply?: string };
      const reply =
        typeof data.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : DOCENT_FALLBACK_REPLY;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };
      const nextMessages = [...currentMsgs, assistantMsg];

      setDocentMessages(nextMessages);
      void saveDocentLog(nextMessages);
    } catch (err) {
      console.error('Docent chat error:', err);
      setError('도슨트의 답을 받지 못했어요. 다시 시도해 주세요.');
    } finally {
      setDocentResponding(false);
      docentBusyRef.current = false;
    }
  };

  /* ── Send message ── */
  const handleSend = async (text: string) => {
    if (responding || validated) return;
    setError(null);

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    let currentMsgs = [...messages, userMsg];
    setMessages(currentMsgs);
    saveChatLog(currentMsgs);

    const newTurnCount = currentMsgs.filter((m) => m.role === 'user').length;

    // Flag check on every student message (fire-and-forget style, but act on result)
    checkForInappropriateContent(currentMsgs).then((result) => {
      if (result.flagged) {
        setPhase('kicked');
      }
    });

    // Validation check
    const shouldValidate =
      newTurnCount >= firstValidateAt &&
      (newTurnCount === firstValidateAt ||
        (newTurnCount - firstValidateAt) % REVALIDATE_INTERVAL === 0);

    let focusField: 'character' | 'conflict' | 'setting' | 'ending' | null = null;
    let validationFeedback: string | null = null;

    if (shouldValidate) {
      const checkMsg: ChatMessage = {
        role: 'system',
        content: '흠, 이야기가 충분한지 볼까??',
        timestamp: new Date().toISOString(),
      };
      currentMsgs = [...currentMsgs, checkMsg];
      setMessages(currentMsgs);
      setValidating(true);

      const validation = await runValidation(currentMsgs);

      if (validation.pass) {
        const passMsg: ChatMessage = {
          role: 'assistant',
          content: '좋아! 이야기 재료가 충분히 모였어! 🎉 아래 "제출하기" 버튼을 눌러서 이야기를 만들어 보자!',
          timestamp: new Date().toISOString(),
        };
        currentMsgs = [...currentMsgs, passMsg];
        setMessages(currentMsgs);
        saveChatLog(currentMsgs);
        setValidated(true);
        setValidationNotice({
          status: 'success',
          title: '이야기 재료가 충분해!',
          lines: validation.feedback_lines.length > 0
            ? validation.feedback_lines
            : ['이제 초안을 만들 만큼 이야기의 뼈대가 잘 모였어.'],
        });
        setValidating(false);
        return;
      }

      focusField = pickFocusField(validation);
      validationFeedback = validation.feedback || null;
      const retryMessage: ChatMessage = {
        role: 'assistant',
        content: buildRetryAssistantMessage(validation),
        timestamp: new Date().toISOString(),
      };
      currentMsgs = [...currentMsgs, retryMessage];
      setMessages(currentMsgs);
      saveChatLog(currentMsgs);
      setValidationNotice({
        status: 'needs_more',
        title: '조금만 더 들려주면 돼',
        lines: validation.feedback_lines.length > 0
          ? validation.feedback_lines
          : ['중요한 인물과 사건이 더 또렷해지면 좋아.'],
        retryPrompt: validation.retry_prompt || '좋아, 두 가지 정도만 더 들려줄래?',
      });
      setValidating(false);
      return;
    }

    // Get 토리 response
    setResponding(true);
    try {
      const res = await fetch('/api/story/guide-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentMsgs.filter((m) => m.role !== 'system'),
          book_id: book.id,
          book_title: book.title,
          story_type: storyType,
          custom_input: customInput,
          selected_activity: selectedActivity,
          language,
          student_turn_count: newTurnCount,
          focus_field: focusField,
          validation_feedback: validationFeedback,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as { reply?: string };
      const reply =
        typeof data.reply === 'string' && data.reply.trim()
          ? data.reply.trim()
          : CHAT_FALLBACK_REPLY;

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      };

      currentMsgs = [...currentMsgs, assistantMsg];
      setMessages(currentMsgs);
      saveChatLog(currentMsgs);
    } catch (err) {
      console.error('Chat error:', err);
      setError('응답을 받지 못했어요. 다시 시도해 주세요.');
    }
    setResponding(false);
  };

  /* ── Submit: generate draft and go to My World 2/7 ── */
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const allStudentMessages = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n');

      const { error: saveStoryError } = await supabase
        .from('stories')
        .update({
          chat_log: messages,
          docent_chat_log: docentMessages,
          docent_recommendations: docentRecommendations,
          selected_activity: selectedActivity,
          all_student_messages: allStudentMessages,
        })
        .eq('id', storyId);

      if (saveStoryError) {
        throw saveStoryError;
      }

      const draftRes = await fetch('/api/story/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          story_type: storyType,
          custom_input: customInput,
          selected_activity: selectedActivity,
          docent_messages: docentMessages,
          all_student_messages: allStudentMessages,
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

      if (draftSaveError) {
        throw draftSaveError;
      }

      router.push(getStepRouteWithLang(bookId, 3, storyId, language));
    } catch (err) {
      console.error('Submit error:', err);
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

      if (!validated) {
        setError('먼저 토리와 대화를 마치고 제출해 주세요.');
        return;
      }
      await handleSubmit();
      return;
    }

    setError('지금은 다음 단계로 바로 이동할 수 없어요.');
  };

  const handleValidatedAction = async () => {
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

    await handleSubmit();
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
          busy={responding || validating || submitting || docentResponding || recommendingActivities || selectingActivity}
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
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-all hover:border-foreground/30 hover:text-foreground"
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
                    궁금했던 장면, 인물, 마음을 물어보세요.
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
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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
                      {recommendingActivities ? '활동을 고르고 있어요' : '답을 쓰고 있어요'}
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
                disabled={docentResponding || recommendingActivities}
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
            className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-heading font-semibold uppercase tracking-[0.2em] text-muted">
                  Step 4 · 다음 활동 추천
                </p>
                <h1 className="mt-1.5 text-2xl font-heading font-bold text-foreground">다음 활동을 골라요</h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                  {docentFarewell || '작가 도슨트와 나눈 이야기를 바탕으로 이어갈 활동을 골라보세요.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleNewChat}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                다시 대화
              </button>
            </div>

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
                  className="group relative flex min-h-56 flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-muted-light text-foreground">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-heading font-semibold uppercase tracking-[0.18em] text-muted">
                      추천 {index + 1}
                    </span>
                  </div>
                  <h2 className="mt-3 text-base font-bold leading-snug text-foreground">
                    {recommendation.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">
                    {recommendation.description}
                  </p>
                  <p className="mt-4 rounded-xl border border-border bg-muted-light/60 px-3 py-2 text-xs leading-relaxed text-muted">
                    {recommendation.starter}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    이 활동으로 시작하기
                    <Check className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </motion.button>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-border bg-card/60 p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-muted-light text-muted">
                  <Feather className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-sm font-bold text-foreground">직접 적어 시작하기</h2>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={customActivityInput}
                  onChange={(event) => setCustomActivityInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleCustomActivitySubmit();
                  }}
                  placeholder="하고 싶은 활동을 적어보세요"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-muted-light/70 px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/40 focus:bg-card"
                />
                <button
                  type="button"
                  onClick={() => void handleCustomActivitySubmit()}
                  disabled={selectingActivity || !customActivityInput.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  선택
                </button>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-error/20 bg-error/5 px-4 py-2.5 text-sm font-medium text-error">
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
            className="flex-1 min-h-0 flex flex-col max-w-2xl mx-auto w-full"
          >
            {/* Header */}
            <div className="sticky top-14 z-20 px-4 pt-4 pb-3 bg-background/95 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3 gap-3">
                <button
                  onClick={handleNewChat}
                  className="inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  새 대화하기
                </button>
                <span className="min-w-0 max-w-[58%] truncate rounded-full border border-border bg-muted-light/70 px-3 py-1 text-[11px] font-semibold text-foreground">
                  {selectedActivity?.title
                    || (storyType === 'custom' && customInput ? customInput : TYPE_LABELS[storyType])}
                </span>
              </div>
              <p className="mb-2 text-[11px] font-heading font-semibold uppercase tracking-[0.18em] text-muted">
                {getDetailStepProgressLabel(1)}
              </p>
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-lg font-bold text-foreground flex items-center gap-2 min-w-0">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-amber-100 bg-amber-50 text-base">
                    {TORI_AVATAR}
                  </span>
                  <span className="truncate">이야기 램프 토리</span>
                </h1>
                <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted">
                  <span className="font-semibold text-foreground">{studentTurnCount}</span>
                  {!validated && studentTurnCount < firstValidateAt && (
                    <span className="text-muted">/ {firstValidateAt}회</span>
                  )}
                  {validated && <span className="font-semibold text-emerald-600">완료</span>}
                </div>
              </div>
              <p className="mt-1.5 ml-10 text-xs leading-relaxed text-muted">
                토리에게 이야기를 들려주세요. 상상력을 발휘한 이야기가 많을수록 더 좋은 결과물이 나와요.
              </p>
              <div className="mt-3 h-px bg-border" />
            </div>

            {/* Chat messages */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg, i) => {
                if (msg.role === 'system') {
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex justify-center my-2"
                    >
                      <span className="text-[11px] font-medium text-muted bg-muted-light/70 border border-border px-4 py-1.5 rounded-full">
                        {msg.content}
                      </span>
                    </motion.div>
                  );
                }

                if (msg.role === 'assistant') {
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex gap-2.5 justify-start"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-sm shadow-sm">
                        {TORI_AVATAR}
                      </div>
                      <div className="max-w-[78%]">
                        <p className="text-[10px] font-semibold tracking-wide text-amber-700 mb-1 ml-1">이야기 램프 토리</p>
                        <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-sm">
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-end"
                  >
                    <div className="max-w-[78%] bg-foreground text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm leading-relaxed shadow-sm">
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    </div>
                  </motion.div>
                );
              })}

              {/* Responding indicator */}
              {responding && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5 justify-start"
                >
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-sm shadow-sm">
                    {TORI_AVATAR}
                  </div>
                  <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Validating indicator */}
              {validating && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex justify-center my-3"
                >
                  <div className="flex items-center gap-2 text-sm bg-card border border-border px-5 py-2.5 rounded-full shadow-sm">
                    <span className="w-4 h-4 border-2 border-border border-t-foreground rounded-full animate-spin" />
                    <span className="font-medium text-foreground">이야기 재료 확인 중...</span>
                  </div>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mb-2 px-4 py-2.5 bg-error/5 border border-error/20 rounded-2xl text-sm text-error font-medium">
                {error}
              </div>
            )}

            {validationNotice && (
              <div className={`mx-4 mb-3 rounded-2xl border px-4 py-3 shadow-sm ${
                validationNotice.status === 'success'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-100 bg-amber-50/80'
              }`}>
                <p className={`text-sm font-bold ${
                  validationNotice.status === 'success' ? 'text-emerald-700' : 'text-amber-800'
                }`}>
                  {validationNotice.title}
                </p>
                <div className="mt-2 space-y-1">
                  {validationNotice.lines.map((line, index) => (
                    <p key={`${line}-${index}`} className="text-sm leading-relaxed text-foreground/85">
                      {line}
                    </p>
                  ))}
                </div>
                {validationNotice.retryPrompt && (
                  <p className="mt-2 text-sm font-medium text-amber-800">
                    {validationNotice.retryPrompt}
                  </p>
                )}
              </div>
            )}

            {/* Bottom area */}
            <div className="border-t border-border bg-card">
              {validated ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-3"
                >
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void handleValidatedAction()}
                    className={`w-full py-3.5 rounded-xl text-base font-bold transition-colors flex items-center justify-center gap-2 ${
                      hasExistingDraft
                        ? 'border border-border bg-card text-foreground hover:bg-muted-light'
                        : 'bg-foreground text-white shadow-sm hover:bg-foreground/90'
                    }`}
                  >
                    <span>{hasExistingDraft ? '📖' : '✨'}</span>
                    {hasExistingDraft ? '이미 만든 이야기 보러 가기' : '이야기 만들러 가기'}
                  </motion.button>
                </motion.div>
              ) : (
                <div className="px-4 py-3">
                  <ChatInput
                    onSend={handleSend}
                    disabled={responding || validating}
                    placeholder="이야기 램프 토리에게 이야기를 들려주세요..."
                  />
                </div>
              )}

              {/* DB connection status */}
              <div className="flex justify-center pb-2">
                <span className="text-[10px] text-muted/70 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    dbConnected === null ? 'bg-border' : dbConnected ? 'bg-emerald-400' : 'bg-error'
                  }`} />
                  {dbConnected === null
                    ? '이야기 램프 토리와 연결 확인 중...'
                    : dbConnected
                      ? '이야기 램프 토리와 연결되었습니다'
                      : '이야기 램프 토리와 연결이 끊겼습니다'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </main>
    </>
  );
}
