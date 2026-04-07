'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { ChatLog } from '@/types/database';

interface ChatSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  chatLogs: ChatLog[];
  onSelectLog: (log: ChatLog) => void;
  activeChatId?: string;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${mins}`;
}

function getFirstUserMessage(messages: { role: string; content: string }[]): string {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return '(대화 내용 없음)';
  return first.content.length > 30
    ? first.content.slice(0, 30) + '...'
    : first.content;
}

export default function ChatSidebar({
  isOpen,
  onClose,
  chatLogs,
  onSelectLog,
  activeChatId,
}: ChatSidebarProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-30 md:hidden"
          />

          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="fixed right-0 top-0 bottom-0 w-72 bg-white border-l border-border z-40 flex flex-col shadow-xl md:relative md:shadow-none"
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">이전 대화 기록</h3>
              <button
                onClick={onClose}
                className="text-muted hover:text-foreground text-lg transition-colors"
                aria-label="닫기"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {chatLogs.length === 0 ? (
                <p className="text-sm text-muted text-center py-8">
                  아직 대화 기록이 없어요
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {chatLogs.map((log) => (
                    <li key={log.id}>
                      <button
                        onClick={() => onSelectLog(log)}
                        className={`w-full text-left p-3 hover:bg-muted-light transition-colors ${
                          activeChatId === log.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-primary">
                            {log.character_name ?? '캐릭터'}
                          </span>
                          <span className="text-xs text-muted">
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-muted line-clamp-2">
                          {getFirstUserMessage(log.messages)}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
