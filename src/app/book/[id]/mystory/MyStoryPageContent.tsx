'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import StoryTypeSelector from '@/components/story/StoryTypeSelector';
import ChatInput from '@/components/chat/ChatInput';
import { createClient } from '@/lib/supabase/client';
import type { Book, StoryType } from '@/types/database';

/* ── Types ── */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/* ── Constants ── */

const FIRST_VALIDATE_AT = 5;
const REVALIDATE_INTERVAL = 3;

const TYPE_LABELS: Record<StoryType, string> = {
  continue: '이야기 이어쓰기',
  new_protagonist: '주인공으로 새 이야기',
  extra_backstory: '엑스트라 뒷이야기',
  change_ending: '결말 바꾸기',
  custom: '기타',
};

const TYPE_COLORS: Record<StoryType, string> = {
  continue: 'bg-blue-100 text-blue-700 border-blue-200',
  new_protagonist: 'bg-amber-100 text-amber-700 border-amber-200',
  extra_backstory: 'bg-purple-100 text-purple-700 border-purple-200',
  change_ending: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  custom: 'bg-rose-100 text-rose-700 border-rose-200',
};

const TORI_AVATAR = '📖✨';
const CHAT_FALLBACK_REPLY = '앗, 잠깐 생각이 끊겼어! 네 이야기를 한 번만 더 말해줄래?';

function buildToriGreeting(storyType: StoryType, customInput: string | null): string {
  const typeLabel = storyType === 'custom' && customInput
    ? customInput
    : TYPE_LABELS[storyType];
  return `안녕! 나는 이야기 도우미 토리야 🌟\n\n"${typeLabel}" 이야기를 쓰고 싶구나! 어떤 이야기를 상상하고 있어? 자유롭게 말해줘!`;
}

/* ── Props ── */

interface MyStoryPageContentProps {
  book: Book;
  bookId: string;
  language: 'ko' | 'en';
  userId: string;
  storyId: string;
  initialStoryType: StoryType;
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
  initialChatLog,
}: MyStoryPageContentProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);

  // Determine initial state
  const hasChatHistory = initialChatLog != null && initialChatLog.length > 0;

  const [phase, setPhase] = useState<'type' | 'chat' | 'kicked'>(
    hasChatHistory ? 'chat' : 'type',
  );
  const [storyType, setStoryType] = useState<StoryType>(initialStoryType);
  const [customInput, setCustomInput] = useState<string | null>(null);

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

  // Count student turns
  const studentTurnCount = messages.filter((m) => m.role === 'user').length;

  // Keep messagesRef in sync for beforeunload
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
  }, [messages, validating]);

  // Save session on beforeunload (tab close / navigate away)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const msgs = messagesRef.current;
      if (msgs.length > 1) {
        const payload = JSON.stringify({ storyId, chatLog: msgs });
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
      saveTimerRef.current = setTimeout(async () => {
        try {
          await supabase
            .from('stories')
            .update({ chat_log: msgs })
            .eq('id', storyId);
        } catch (err) {
          console.error('Failed to save chat log:', err);
        }
      }, 800);
    },
    [supabase, storyId],
  );

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  /* ── Flag check: run after each student message ── */
  const checkForInappropriateContent = useCallback(
    async (msgs: ChatMessage[]): Promise<{ flagged: boolean; reason: string }> => {
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
            character_name: '토리',
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

  /* ── Handle story type selection ── */
  const handleTypeSelect = (type: StoryType, custom?: string) => {
    setError(null);
    setStoryType(type);
    setCustomInput(custom ?? null);

    const greeting: ChatMessage = {
      role: 'assistant',
      content: buildToriGreeting(type, custom ?? null),
      timestamp: new Date().toISOString(),
    };
    setMessages([greeting]);
    setValidated(false);
    setPhase('chat');

    // Save to DB in background
    supabase
      .from('stories')
      .update({ story_type: type, custom_input: custom ?? null })
      .eq('id', storyId)
      .then(({ error: dbErr }: { error: unknown }) => {
        if (dbErr) console.error('Failed to save story type:', dbErr);
      });
    saveChatLog([greeting]);
  };

  /* ── New chat: reset session ── */
  const handleNewChat = () => {
    // Clear chat from DB
    supabase
      .from('stories')
      .update({ chat_log: {}, all_student_messages: null })
      .eq('id', storyId)
      .then(({ error: dbErr }: { error: unknown }) => {
        if (dbErr) console.error('Failed to clear chat:', dbErr);
      });

    setMessages([]);
    setValidated(false);
    setError(null);
    setPhase('type');
  };

  /* ── Run validation ── */
  const runValidation = useCallback(
    async (msgs: ChatMessage[]): Promise<boolean> => {
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
        return data.pass === true;
      } catch {
        return false;
      }
    },
    [],
  );

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
      newTurnCount >= FIRST_VALIDATE_AT &&
      (newTurnCount === FIRST_VALIDATE_AT ||
        (newTurnCount - FIRST_VALIDATE_AT) % REVALIDATE_INTERVAL === 0);

    if (shouldValidate) {
      const checkMsg: ChatMessage = {
        role: 'system',
        content: '잠시만, 이야기를 쓸 수 있는지 확인해볼게!',
        timestamp: new Date().toISOString(),
      };
      currentMsgs = [...currentMsgs, checkMsg];
      setMessages(currentMsgs);
      setValidating(true);

      const passed = await runValidation(currentMsgs);

      if (passed) {
        const passMsg: ChatMessage = {
          role: 'assistant',
          content: '좋아! 이야기 재료가 충분히 모였어! 🎉 아래 "제출하기" 버튼을 눌러서 이야기를 만들어 보자!',
          timestamp: new Date().toISOString(),
        };
        currentMsgs = [...currentMsgs, passMsg];
        setMessages(currentMsgs);
        saveChatLog(currentMsgs);
        setValidated(true);
        setValidating(false);
        return;
      }

      setValidating(false);
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
          language,
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

  /* ── Submit: generate draft and go to Step 3 ── */
  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const allStudentMessages = messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n\n');

      await supabase
        .from('stories')
        .update({
          chat_log: messages,
          all_student_messages: allStudentMessages,
        })
        .eq('id', storyId);

      const draftRes = await fetch('/api/story/generate-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: book.id,
          story_type: storyType,
          custom_input: customInput,
          all_student_messages: allStudentMessages,
          language,
        }),
      });

      const draftData = await draftRes.json();

      if (!draftData.pages || draftData.pages.length === 0) {
        setError('초안 생성에 실패했어요. 다시 시도해 주세요.');
        setSubmitting(false);
        return;
      }

      await supabase
        .from('stories')
        .update({ ai_draft: draftData.pages, current_step: 3 })
        .eq('id', storyId);

      router.push(`/book/${bookId}/mystory/draft?storyId=${storyId}&lang=${language}`);
    } catch (err) {
      console.error('Submit error:', err);
      setError('오류가 발생했어요. 다시 시도해 주세요.');
      setSubmitting(false);
    }
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
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-3xl">🚫</span>
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">대화가 중단되었어요</h2>
          <p className="text-sm text-muted mb-6">
            수업과 관련 없는 내용이 감지되어 대화가 종료되었어요.
            선생님께 알림이 전달되었습니다.
          </p>
          <button
            onClick={() => router.push(`/book/${bookId}/activity?lang=${language}`)}
            className="px-6 py-3 bg-foreground text-white rounded-xl text-sm font-medium hover:bg-foreground/90 transition-colors"
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
      <main className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-12 h-12 border-4 rounded-full border-muted-light border-t-primary animate-spin" />
          <div>
            <p className="text-lg font-bold text-foreground">이야기 초안을 만들고 있어요...</p>
            <p className="text-sm text-muted mt-1">토리가 열심히 준비하고 있어! 잠깐만 기다려 줘 🌟</p>
          </div>
        </div>
      </main>
    );
  }

  /* ── Render ── */
  return (
    <main className="flex-1 flex flex-col">
      <AnimatePresence mode="wait">
        {phase === 'type' ? (
          <motion.div
            key="type-phase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 px-4 py-8"
          >
            <StoryTypeSelector onSelect={handleTypeSelect} />
          </motion.div>
        ) : (
          <motion.div
            key="chat-phase"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col max-w-2xl mx-auto w-full"
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={handleNewChat}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border text-xs font-medium text-muted hover:text-foreground hover:border-foreground/30 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  새 대화하기
                </button>
                <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${TYPE_COLORS[storyType]}`}>
                  {storyType === 'custom' && customInput
                    ? customInput
                    : TYPE_LABELS[storyType]}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <span className="text-xl">{TORI_AVATAR}</span> 토리와 이야기 만들기
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-muted bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                  <span>💬</span>
                  <span className="font-semibold text-amber-700">{studentTurnCount}</span>
                  {!validated && studentTurnCount < FIRST_VALIDATE_AT && (
                    <span className="text-amber-500">/ {FIRST_VALIDATE_AT}회</span>
                  )}
                  {validated && <span className="text-emerald-600">완료!</span>}
                </div>
              </div>
            </div>

            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg, i) => {
                if (msg.role === 'system') {
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex justify-center my-2"
                    >
                      <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-4 py-1.5 rounded-full font-medium">
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
                      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 flex items-center justify-center text-sm shadow-sm">
                        {TORI_AVATAR}
                      </div>
                      <div className="max-w-[78%]">
                        <p className="text-[10px] font-bold text-amber-600 mb-1 ml-1">토리</p>
                        <div className="bg-white border border-amber-100 rounded-2xl rounded-tl-md px-4 py-2.5 text-sm leading-relaxed text-foreground shadow-sm">
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
                    <div className="max-w-[78%] bg-primary text-white rounded-2xl rounded-tr-md px-4 py-2.5 text-sm leading-relaxed shadow-sm">
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
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200 flex items-center justify-center text-sm shadow-sm">
                    {TORI_AVATAR}
                  </div>
                  <div className="bg-white border border-amber-100 rounded-2xl rounded-tl-md px-4 py-3 shadow-sm">
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
                  <div className="flex items-center gap-2 text-sm bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 px-5 py-2.5 rounded-full shadow-sm">
                    <span className="w-4 h-4 border-2 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
                    <span className="font-medium text-amber-700">이야기 재료 확인 중...</span>
                  </div>
                </motion.div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mb-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-medium">
                {error}
              </div>
            )}

            {/* Bottom area */}
            <div className="border-t border-amber-100 bg-gradient-to-t from-amber-50/50 to-white">
              {validated ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-3"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSubmit}
                    className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-2xl text-base font-bold shadow-lg shadow-amber-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <span>✨</span> 이야기 만들러 가기
                  </motion.button>
                </motion.div>
              ) : (
                <div className="px-4 py-3">
                  <ChatInput
                    onSend={handleSend}
                    disabled={responding || validating}
                    placeholder="토리에게 이야기를 설명해 보세요..."
                  />
                </div>
              )}

              {/* DB connection status */}
              <div className="flex justify-center pb-2">
                <span className="text-[10px] text-muted/60 flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    dbConnected === null ? 'bg-gray-300' : dbConnected ? 'bg-emerald-400' : 'bg-red-400'
                  }`} />
                  {dbConnected === null
                    ? '토리와 연결 확인 중...'
                    : dbConnected
                      ? '토리와 연결되었습니다'
                      : '토리와 연결이 끊겼습니다'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
