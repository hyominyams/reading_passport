'use client';

import type { ChatLog } from '@/types/database';

interface ChatHistoryViewProps {
  chatLog: ChatLog;
  studentName: string;
  onBack: () => void;
}

const QUESTION_CATEGORIES = [
  { prefix: '[내용이해]', icon: '📖', title: '내용이해' },
  { prefix: '[인물이해]', icon: '👤', title: '인물이해' },
  { prefix: '[배경이해]', icon: '🌍', title: '배경이해' },
  { prefix: '[추론]', icon: '💡', title: '추론' },
];

export default function ChatHistoryView({ chatLog, studentName, onBack }: ChatHistoryViewProps) {
  const messages = chatLog.messages ?? [];
  const date = new Date(chatLog.created_at).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const isQuestions = chatLog.chat_type === 'questions';

  if (isQuestions) {
    // Parse questions from messages
    const userMessages = messages.filter(m => m.role === 'user');

    // Group by category prefix
    const grouped: Record<string, string[]> = {};
    for (const msg of userMessages) {
      const cat = QUESTION_CATEGORIES.find(c => msg.content.startsWith(c.prefix));
      const key = cat?.title ?? '기타';
      const text = cat ? msg.content.slice(cat.prefix.length).trim() : msg.content;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(text);
    }

    return (
      <div>
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4 transition-colors"
        >
          <span>{'\u2190'}</span>
          <span>돌아가기</span>
        </button>

        <div className="border border-border rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold text-lg">{studentName}의 질문</h2>
            <div className="flex items-center gap-3 text-sm text-muted">
              <span>{date}</span>
              <span>총 {userMessages.length}개 질문</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {QUESTION_CATEGORIES.map(cat => {
            const questions = grouped[cat.title];
            if (!questions?.length) return null;
            return (
              <div key={cat.title} className="border border-border rounded-xl p-4">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2 mb-3">
                  <span>{cat.icon}</span>
                  <span>{cat.title}</span>
                  <span className="text-muted font-normal">({questions.length}개)</span>
                </h3>
                <div className="space-y-2">
                  {questions.map((q, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-muted w-5 shrink-0 text-center">{i + 1}.</span>
                      <p className="text-foreground">{q}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Default: chat message view (character chat, etc.)
  const characterName = chatLog.character_name ?? '캐릭터';
  const turnCount = messages.length;

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted hover:text-foreground mb-4 transition-colors"
      >
        <span>{'\u2190'}</span>
        <span>돌아가기</span>
      </button>

      <div className="border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-bold text-lg">
            {studentName} {'\u00D7'} {characterName}
          </h2>
          <div className="flex items-center gap-3 text-sm text-muted">
            <span>{date}</span>
            <span>총 {turnCount}턴</span>
          </div>
        </div>

        {chatLog.flagged && (
          <div className="mt-3 p-3 bg-error/10 border border-error/20 rounded-lg text-sm text-error flex items-center gap-2">
            <span>{'\u26A0\uFE0F'}</span>
            <span>이 대화는 부적절한 내용으로 플래그 처리되었습니다</span>
          </div>
        )}
      </div>

      <div className="space-y-3">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-muted">
            대화 내역이 없습니다
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isStudent = msg.role === 'user' || msg.role === 'student';
            return (
              <div
                key={idx}
                className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                    isStudent
                      ? 'bg-primary text-white rounded-br-md'
                      : 'bg-muted-light text-foreground rounded-bl-md'
                  }`}
                >
                  <div className="text-xs font-medium mb-1 opacity-70">
                    {isStudent ? studentName : characterName}
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {msg.content}
                  </p>
                  {msg.timestamp && (
                    <div className="text-[10px] opacity-50 mt-1 text-right">
                      {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
