'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GaugeBar from './GaugeBar';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CollectionState {
  character: boolean;
  setting: boolean;
  conflict: boolean;
  ending: boolean;
}

interface GaugeChatInterfaceProps {
  storyType: string;
  customInput?: string;
  bookTitle: string;
  country: string;
  storySummary: string;
  characters: string;
  language?: string;
  onSubmit: (data: {
    messages: ChatMessage[];
    allStudentMessages: string;
    gaugeFinal: number;
    collectionState: CollectionState;
  }) => void;
}

const KEYWORDS: Record<keyof CollectionState, string[]> = {
  character: ['주인공', '캐릭터', '등장인물', '소녀', '소년', '아이', '사람', '친구', '동물', '왕', '공주', '용', '마법사', '이름'],
  setting: ['장소', '배경', '어디', '마을', '숲', '바다', '산', '학교', '집', '나라', '도시', '왕국', '세계'],
  conflict: ['사건', '갈등', '문제', '위험', '싸움', '도전', '어려움', '나쁜', '적', '위기', '일어나', '생겨', '발견'],
  ending: ['결말', '끝', '마지막', '해결', '행복', '되었다', '마무리', '결국', '드디어', '성공'],
};

function calculateGaugeIncrease(input: string, collectionState: CollectionState): { increase: number; bonus: boolean } {
  const len = input.length;
  let increase = 0;

  if (len < 10) increase = 3;
  else if (len <= 30) increase = 8;
  else if (len <= 60) increase = 15;
  else increase = 20;

  // Keyword bonus: check which unfilled items match
  let bonus = false;
  for (const [key, keywords] of Object.entries(KEYWORDS)) {
    if (!collectionState[key as keyof CollectionState]) {
      if (keywords.some((kw) => input.includes(kw))) {
        bonus = true;
        break;
      }
    }
  }

  if (bonus) increase += 10;

  return { increase, bonus };
}

function detectCollectedItems(allMessages: string): CollectionState {
  const state: CollectionState = {
    character: false,
    setting: false,
    conflict: false,
    ending: false,
  };

  for (const [key, keywords] of Object.entries(KEYWORDS)) {
    const matchCount = keywords.filter((kw) => allMessages.includes(kw)).length;
    if (matchCount >= 2 || allMessages.length > 50) {
      // Simple heuristic: if 2+ keywords match, consider collected
      state[key as keyof CollectionState] = keywords.some((kw) => allMessages.includes(kw));
    }
  }

  return state;
}

export default function GaugeChatInterface({
  storyType,
  customInput,
  bookTitle,
  country,
  storySummary,
  characters,
  language = 'ko',
  onSubmit,
}: GaugeChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [gauge, setGauge] = useState(0);
  const [turnCount, setTurnCount] = useState(0);
  const [collectionState, setCollectionState] = useState<CollectionState>({
    character: false,
    setting: false,
    conflict: false,
    ending: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Send first greeting
  useEffect(() => {
    const sendGreeting = async () => {
      setIsStreaming(true);
      try {
        const storyTypeLabels: Record<string, string> = {
          continue: '이야기 이어쓰기',
          new_protagonist: '주인공으로 새 이야기 써보기',
          extra_backstory: '엑스트라 주인공의 뒷이야기 쓰기',
          change_ending: '결말 바꾸기',
          custom: `기타: ${customInput}`,
        };

        const response = await fetch('/api/story/gauge-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: `안녕! 나는 "${bookTitle}" 책을 읽고 "${storyTypeLabels[storyType]}" 유형으로 이야기를 만들고 싶어.`,
              },
            ],
            story_type: storyType,
            custom_input: customInput,
            book_title: bookTitle,
            country,
            story_summary: storySummary,
            characters,
            language,
          }),
        });

        const reader = response.body?.getReader();
        if (!reader) return;

        let assistantMsg = '';
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

          for (const line of lines) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              assistantMsg += parsed.text;
              setMessages([{ role: 'assistant', content: assistantMsg }]);
            } catch {
              // skip parse errors
            }
          }
        }

        setMessages([{ role: 'assistant', content: assistantMsg }]);
      } catch (err) {
        console.error('Greeting error:', err);
        setMessages([
          {
            role: 'assistant',
            content: '안녕! 이야기를 함께 만들어 보자. 어떤 이야기를 생각하고 있어?',
          },
        ]);
      }
      setIsStreaming(false);
    };

    sendGreeting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage = input.trim();
    setInput('');
    setValidationError(null);

    // Calculate gauge increase
    const { increase } = calculateGaugeIncrease(userMessage, collectionState);
    const newTurn = turnCount + 1;
    setTurnCount(newTurn);

    let newGauge = gauge + increase;
    // Under 5 turns: max 80% cap
    if (newTurn < 5) {
      newGauge = Math.min(80, newGauge);
    }
    newGauge = Math.min(100, newGauge);
    setGauge(newGauge);

    // Update collection state
    const allStudentMsgs = [
      ...messages.filter((m) => m.role === 'user').map((m) => m.content),
      userMessage,
    ].join(' ');
    const newCollection = detectCollectedItems(allStudentMsgs);
    setCollectionState(newCollection);

    // Add user message
    const updatedMessages: ChatMessage[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(updatedMessages);

    // Stream AI response
    setIsStreaming(true);
    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch('/api/story/gauge-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          story_type: storyType,
          custom_input: customInput,
          book_title: bookTitle,
          country,
          story_summary: storySummary,
          characters,
          language,
        }),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      let assistantMsg = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((l) => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            assistantMsg += parsed.text;
            setMessages([...updatedMessages, { role: 'assistant', content: assistantMsg }]);
          } catch {
            // skip
          }
        }
      }

      setMessages([...updatedMessages, { role: 'assistant', content: assistantMsg }]);
    } catch (err) {
      console.error('Chat error:', err);
    }
    setIsStreaming(false);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setValidationError(null);

    const allStudentMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n');

    try {
      const response = await fetch('/api/story/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all_student_messages: allStudentMessages }),
      });

      const validation = await response.json();

      if (validation.pass) {
        onSubmit({
          messages,
          allStudentMessages,
          gaugeFinal: gauge,
          collectionState,
        });
      } else {
        // Flat -10% penalty on validation failure (regardless of how many items are missing)
        setGauge((prev) => Math.max(0, prev - 10));

        setCollectionState({
          character: validation.character ?? collectionState.character,
          setting: validation.setting ?? collectionState.setting,
          conflict: validation.conflict ?? collectionState.conflict,
          ending: validation.ending ?? collectionState.ending,
        });

        setValidationError(
          validation.feedback || '이런 내용이 조금 더 필요해요'
        );
      }
    } catch (err) {
      console.error('Submit error:', err);
      setValidationError('제출 중 오류가 발생했어요. 다시 시도해 주세요.');
    }

    setIsSubmitting(false);
  };

  const canSubmit = turnCount >= 5;

  const gaugeItems = [
    { key: 'character', label: '등장인물', collected: collectionState.character, color: '#3b82f6' },
    { key: 'setting', label: '배경/장소', collected: collectionState.setting, color: '#8b5cf6' },
    { key: 'conflict', label: '사건/갈등', collected: collectionState.conflict, color: '#ec4899' },
    { key: 'ending', label: '결말 방향', collected: collectionState.ending, color: '#f59e0b' },
  ];

  return (
    <div className="flex gap-6 h-[calc(100vh-12rem)] max-w-5xl mx-auto">
      {/* Left: Chat Interface */}
      <div className="flex-1 flex flex-col bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <AnimatePresence>
            {messages.map((msg, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                    ${
                      msg.role === 'user'
                        ? 'bg-primary text-white rounded-br-md'
                        : 'bg-muted-light text-foreground rounded-bl-md'
                    }
                  `}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isStreaming && messages.length > 0 && messages[messages.length - 1].role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-muted-light text-foreground px-4 py-3 rounded-2xl rounded-bl-md">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Validation error */}
        {validationError && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mb-2 p-3 bg-secondary/10 border border-secondary/30 rounded-xl text-sm text-secondary-dark"
          >
            {validationError}
          </motion.div>
        )}

        {/* Input area */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="이야기 재료를 자유롭게 입력해 보세요..."
              rows={2}
              className="flex-1 px-4 py-3 rounded-xl border border-border bg-white focus:border-primary focus:outline-none text-sm text-foreground resize-none"
              disabled={isStreaming}
            />
            <div className="flex flex-col gap-2">
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                전송
              </button>
              {canSubmit && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={handleSubmit}
                  disabled={isSubmitting || isStreaming}
                  className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-medium hover:bg-accent-dark transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? '확인 중...' : '제출하기'}
                </motion.button>
              )}
            </div>
          </div>
          {!canSubmit && (
            <p className="text-xs text-muted mt-2">
              {5 - turnCount}번 더 대화하면 제출할 수 있어요
            </p>
          )}
        </div>
      </div>

      {/* Right: Gauge Bar */}
      <div className="w-40 bg-card rounded-2xl border border-border shadow-sm p-4">
        <GaugeBar
          percentage={gauge}
          items={gaugeItems}
          showHint={gauge >= 90}
        />
      </div>
    </div>
  );
}
