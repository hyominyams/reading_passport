'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/common/Header';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import CharacterCard, { type CharacterData } from '@/components/chat/CharacterCard';
import ChatBubble from '@/components/chat/ChatBubble';
import ChatInput from '@/components/chat/ChatInput';
import ChatSidebar from '@/components/chat/ChatSidebar';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import type { Book, ChatLog, ChatMessage, Activity } from '@/types/database';

interface LocalMessage {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const bookId = params.id as string;
  const language = searchParams.get('lang') === 'en' ? 'en' : 'ko';
  const { user, loading: authLoading } = useAuth();

  // Phase: 'select' or 'chat'
  const [phase, setPhase] = useState<'select' | 'chat' | 'readonly'>('select');

  // Book and character data
  const [book, setBook] = useState<Book | null>(null);
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterData | null>(null);

  // Chat state
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatLogs, setChatLogs] = useState<ChatLog[]>([]);
  const [readonlyLog, setReadonlyLog] = useState<ChatLog | null>(null);

  // Stamp
  const [showStampAnimation, setShowStampAnimation] = useState(false);
  const [characterStampEarned, setCharacterStampEarned] = useState(false);

  // Loading
  const [loading, setLoading] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);

  // Count conversation turns (user messages)
  const userTurnCount = messages.filter((m) => m.role === 'user').length;

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      // Fetch book
      const { data: bookData } = await supabase
        .from('books')
        .select('*')
        .eq('id', bookId)
        .single();

      if (bookData) {
        const b = bookData as Book;
        setBook(b);

        // Parse characters from character_analysis
        const analysis = b.character_analysis as {
          characters?: CharacterData[];
          story_summary?: string;
        };
        if (analysis?.characters && Array.isArray(analysis.characters)) {
          const chars: CharacterData[] = analysis.characters.map(
            (c: CharacterData, idx: number) => ({
              ...c,
              id: String(idx),
            })
          );
          setCharacters(chars);
        }
      }

      // Fetch chat logs
      const { data: logsData } = await supabase
        .from('chat_logs')
        .select('*')
        .eq('student_id', user.id)
        .eq('book_id', bookId)
        .eq('chat_type', 'character')
        .eq('language', language)
        .order('created_at', { ascending: false });

      setChatLogs((logsData ?? []) as ChatLog[]);

      // Check if stamp already earned
      const { data: activityData } = await supabase
        .from('activities')
        .select('*')
        .eq('student_id', user.id)
        .eq('book_id', bookId)
        .maybeSingle();

      if (activityData) {
        const act = activityData as Activity;
        setCharacterStampEarned((act.stamps_earned as string[]).includes('character'));
      }
    } catch (err) {
      console.error('Error fetching chat data:', err);
    } finally {
      setLoading(false);
    }
  }, [user, bookId, language, supabase]);

  useEffect(() => {
    if (!authLoading && user) {
      fetchData();
    }
  }, [authLoading, user, fetchData]);

  // Select a character and start chat
  const handleSelectCharacter = (character: CharacterData) => {
    setSelectedCharacter(character);
    setMessages([]);
    setStreamingContent('');
    setPhase('chat');

    // Send initial greeting from character
    const greeting: LocalMessage = {
      role: 'assistant',
      content:
        language === 'en'
          ? `Hi! I'm ${character.name}. Do you want to talk about this story? What are you curious about?`
          : `안녕! 나는 ${character.name}이야. 이 이야기에 대해 이야기해 볼래? 무엇이 궁금해?`,
    };
    setMessages([greeting]);
  };

  // Send message
  const handleSendMessage = async (text: string) => {
    if (!book || !selectedCharacter || isStreaming) return;

    const newUserMessage: LocalMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages);
    setIsStreaming(true);
    setStreamingContent('');

    try {
      const response = await fetch('/api/chat/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookId,
            characterId: selectedCharacter.id,
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            language,
            characterAnalysis: book.character_analysis,
          }),
        });

      if (!response.ok) {
        throw new Error('Chat API request failed');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullContent += parsed.content;
                setStreamingContent(fullContent);
              }
            } catch {
              // ignore parse errors for partial chunks
            }
          }
        }
      }

      // Finalize the assistant message
      const assistantMessage: LocalMessage = {
        role: 'assistant',
        content: fullContent,
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');

      // Award stamp after minimum 3 conversation turns
      const newUserTurnCount = updatedMessages.filter((m) => m.role === 'user').length;
      if (!characterStampEarned && newUserTurnCount >= 3) {
        await awardCharacterStamp();
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '죄송해요, 잠시 문제가 생겼어요. 다시 말해줄래?',
        },
      ]);
      setStreamingContent('');
    } finally {
      setIsStreaming(false);
    }
  };

  // Award character stamp
  const awardCharacterStamp = async () => {
    if (!user) return;

    try {
      const { data: existing } = await supabase
        .from('activities')
        .select('*')
        .eq('student_id', user.id)
        .eq('book_id', bookId)
        .maybeSingle();

      if (existing) {
        const act = existing as Activity;
        if ((act.stamps_earned as string[]).includes('character')) return;

        const completedTabs = [...act.completed_tabs, 'character'];
        const stampsEarned = [...(act.stamps_earned as string[]), 'character'];

        await supabase
          .from('activities')
          .update({ completed_tabs: completedTabs, stamps_earned: stampsEarned })
          .eq('id', act.id);
      } else {
        // Create activity record if it doesn't exist yet
        await supabase.from('activities').insert({
          student_id: user.id,
          book_id: bookId,
          country_id: book?.country_id ?? '',
          language,
          completed_tabs: ['character'],
          stamps_earned: ['character'],
        });
      }

      setCharacterStampEarned(true);
      setShowStampAnimation(true);
      setTimeout(() => setShowStampAnimation(false), 3000);
    } catch (err) {
      console.error('Error awarding stamp:', err);
    }
  };

  // Ref to track if session was already saved (avoid double-saves)
  const sessionSavedRef = useRef(false);

  // Core save logic - extracted for reuse
  const saveChatSession = useCallback(async (
    msgs: LocalMessage[],
    character: CharacterData,
    opts: { refreshLogs?: boolean } = {}
  ) => {
    if (!user || msgs.length <= 1 || sessionSavedRef.current) return;
    sessionSavedRef.current = true;

    try {
      const chatMessages: ChatMessage[] = msgs.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString(),
      }));

      const { data } = await supabase
        .from('chat_logs')
        .insert({
          student_id: user.id,
          book_id: bookId,
          character_id: character.id,
          character_name: character.name,
          chat_type: 'character',
          messages: chatMessages,
          language,
          flagged: false,
          ended_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      // Trigger async flag check
      if (data?.id) {
        fetch('/api/chat/flag', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatLogId: data.id,
            messages: chatMessages,
          }),
        }).catch(() => {
          // Fire and forget
        });

        if (opts.refreshLogs) {
          const { data: logsData } = await supabase
            .from('chat_logs')
            .select('*')
            .eq('student_id', user.id)
            .eq('book_id', bookId)
            .eq('chat_type', 'character')
            .eq('language', language)
            .order('created_at', { ascending: false });

          setChatLogs((logsData ?? []) as ChatLog[]);
        }
      }
    } catch (err) {
      console.error('Error saving chat session:', err);
      sessionSavedRef.current = false; // Allow retry on error
    }
  }, [user, bookId, language, supabase]);

  // Auto-save on page unload (back navigation, tab close, etc.)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (phase === 'chat' && selectedCharacter && messages.length > 1 && !sessionSavedRef.current) {
        // Use sendBeacon for reliable save on page unload
        const chatMessages = messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: new Date().toISOString(),
        }));
        const payload = JSON.stringify({
          student_id: user?.id,
          book_id: bookId,
          character_id: selectedCharacter.id,
          character_name: selectedCharacter.name,
          chat_type: 'character',
          messages: chatMessages,
          language,
        });
        navigator.sendBeacon('/api/chat/save', payload);
        sessionSavedRef.current = true;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [phase, selectedCharacter, messages, user, bookId, language]);

  // Save current session and go back to character select
  const handleNewChat = async () => {
    if (!user || !selectedCharacter || messages.length <= 1) {
      setPhase('select');
      setMessages([]);
      setSelectedCharacter(null);
      return;
    }

    await saveChatSession(messages, selectedCharacter, { refreshLogs: true });

    setPhase('select');
    setMessages([]);
    setSelectedCharacter(null);
    sessionSavedRef.current = false; // Reset for next session
  };

  // View a previous chat log (read-only)
  const handleSelectLog = (log: ChatLog) => {
    setReadonlyLog(log);
    setPhase('readonly');
    setSidebarOpen(false);
  };

  // Back from readonly to select
  const handleBackFromReadonly = () => {
    setReadonlyLog(null);
    setPhase('select');
  };

  if (authLoading || loading) {
    return (
      <>
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="데이터를 불러오는 중..." />
        </main>
      </>
    );
  }

  // Phase: Read-only view of a previous conversation
  if (phase === 'readonly' && readonlyLog) {
    return (
      <>
        <Header />
        <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
          {/* Readonly header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white sticky top-14 z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">
                💬
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">
                  {readonlyLog.character_name ?? '캐릭터'}
                </p>
                <p className="text-xs text-muted">이전 대화 기록 (읽기 전용)</p>
              </div>
            </div>
            <button
              onClick={handleBackFromReadonly}
              className="text-sm text-primary font-medium hover:underline"
            >
              &larr; 돌아가기
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {readonlyLog.messages.map((msg, idx) => (
              <ChatBubble
                key={idx}
                role={msg.role as 'user' | 'assistant'}
                content={msg.content}
                characterName={
                  msg.role === 'assistant'
                    ? readonlyLog.character_name ?? undefined
                    : undefined
                }
              />
            ))}
          </div>
        </main>
      </>
    );
  }

  // Phase: Character Selection
  if (phase === 'select') {
    return (
      <>
        <Header />
        <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
                <span>💬</span> 캐릭터와 대화하기
              </h1>
              <p className="text-sm text-muted mt-1">
                이야기 속 캐릭터를 선택하고 대화를 시작해 보세요
              </p>
            </div>
            <div className="flex items-center gap-2">
              {chatLogs.length > 0 && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="text-sm px-3 py-1.5 border border-border rounded-lg text-muted hover:text-foreground hover:border-primary transition-colors"
                >
                  &#9776; 이전 대화
                </button>
              )}
              <button
                onClick={() => router.back()}
                className="text-sm text-muted hover:text-foreground transition-colors"
              >
                &larr; 돌아가기
              </button>
            </div>
          </div>

          {characters.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-16">
              <div className="text-center">
                <span className="text-4xl block mb-4">🎭</span>
                <p className="text-muted text-sm">
                  아직 캐릭터 분석이 완료되지 않았어요
                </p>
                <p className="text-xs text-muted mt-1">
                  선생님이 캐릭터를 등록하면 대화를 시작할 수 있어요
                </p>
              </div>
            </div>
          ) : (
            <>
              {characterStampEarned && (
                <div className="mb-4 px-4 py-2 bg-success/10 border border-success/30 rounded-xl text-sm text-success font-medium flex items-center gap-2">
                  <span>💬</span>
                  <span>캐릭터 대화 스탬프를 이미 획득했어요!</span>
                </div>
              )}

              <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
                {characters.map((character) => (
                  <div key={character.id} className="snap-start">
                    <CharacterCard
                      character={character}
                      onSelect={handleSelectCharacter}
                    />
                  </div>
                ))}
              </div>

              {/* Previous conversations section */}
              {chatLogs.length > 0 && (
                <div className="mt-8">
                  <h2 className="text-sm font-bold text-foreground mb-3">
                    이전 대화 기록
                  </h2>
                  <div className="space-y-2">
                    {chatLogs.slice(0, 5).map((log) => (
                      <button
                        key={log.id}
                        onClick={() => handleSelectLog(log)}
                        className="w-full text-left p-3 bg-card border border-border rounded-xl hover:border-primary hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-primary">
                            {log.character_name ?? '캐릭터'}
                          </span>
                          <span className="text-xs text-muted">
                            {new Date(log.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                        <p className="text-xs text-muted line-clamp-1">
                          {log.messages.find((m) => m.role === 'user')?.content ??
                            '(대화 내용)'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <ChatSidebar
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            chatLogs={chatLogs}
            onSelectLog={handleSelectLog}
          />
        </main>
      </>
    );
  }

  // Phase: Chat Interface
  return (
    <>
      <Header />
      <main className="flex-1 flex flex-col max-w-3xl mx-auto w-full h-[calc(100vh-56px)]">
        {/* Chat header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-white sticky top-14 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">
              💬
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">
                {selectedCharacter?.name ?? '캐릭터'}
              </p>
              <p className="text-xs text-muted">
                {selectedCharacter?.role}
                {userTurnCount > 0 && ` \u00B7 ${userTurnCount}번 대화`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="text-sm px-3 py-1.5 bg-primary/10 text-primary rounded-lg font-medium hover:bg-primary/20 transition-colors"
            >
              새 채팅
            </button>
            <button
              onClick={() => setSidebarOpen(true)}
              className="text-sm px-2 py-1.5 border border-border rounded-lg text-muted hover:text-foreground hover:border-primary transition-colors"
              aria-label="이전 대화"
            >
              &#9776;
            </button>
          </div>
        </div>

        {/* Chat messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, idx) => (
            <ChatBubble
              key={idx}
              role={msg.role}
              content={msg.content}
              characterName={
                msg.role === 'assistant'
                  ? selectedCharacter?.name
                  : undefined
              }
            />
          ))}

          {/* Streaming message */}
          {isStreaming && streamingContent && (
            <ChatBubble
              role="assistant"
              content={streamingContent}
              characterName={selectedCharacter?.name}
              isStreaming
            />
          )}

          {/* Loading indicator */}
          {isStreaming && !streamingContent && (
            <div className="flex items-center gap-2 pl-10">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Stamp hint */}
          {!characterStampEarned && (
            <div className="text-center py-2">
              <p className="text-xs text-muted">
                {userTurnCount === 0
                  ? '💬 대화를 시작하면 스탬프를 받을 수 있어요!'
                  : userTurnCount < 3
                    ? `💬 스탬프까지 ${3 - userTurnCount}번 더 대화해 보세요!`
                    : ''}
              </p>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Chat input */}
        <ChatInput
          onSend={handleSendMessage}
          disabled={isStreaming}
          placeholder={`${selectedCharacter?.name ?? '캐릭터'}에게 메시지 보내기...`}
        />

        {/* Sidebar */}
        <ChatSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          chatLogs={chatLogs}
          onSelectLog={handleSelectLog}
        />

        {/* Stamp Animation */}
        <AnimatePresence>
          {showStampAnimation && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 pointer-events-none"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                className="bg-white rounded-3xl p-8 shadow-2xl text-center"
              >
                <div className="text-6xl mb-4">💬</div>
                <h2 className="text-xl font-bold text-foreground mb-2">
                  캐릭터 대화 스탬프 획득!
                </h2>
                <p className="text-sm text-muted">
                  캐릭터와 멋진 대화를 나눴어요
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
