'use client';

import { motion } from 'framer-motion';

interface ChatBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  characterName?: string;
  isStreaming?: boolean;
}

export default function ChatBubble({
  role,
  content,
  characterName,
  isStreaming = false,
}: ChatBubbleProps) {
  const isAssistant = role === 'assistant';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2 ${isAssistant ? 'justify-start' : 'justify-end'}`}
    >
      {isAssistant && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm">
          💬
        </div>
      )}

      <div
        className={`
          max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed
          ${
            isAssistant
              ? 'bg-muted-light text-foreground rounded-tl-sm'
              : 'bg-primary text-white rounded-tr-sm'
          }
        `}
      >
        {isAssistant && characterName && (
          <p className="text-xs font-bold text-primary mb-1">{characterName}</p>
        )}
        <p className="whitespace-pre-wrap break-words">
          {content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-primary/60 animate-pulse ml-0.5 align-middle rounded-sm" />
          )}
        </p>
      </div>
    </motion.div>
  );
}
