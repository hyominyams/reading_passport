'use client';

import { motion } from 'framer-motion';

interface EditorCardProps {
  index: number;
  aiDraft: string;
  studentText: string;
  onChange: (text: string) => void;
  label: string;
}

export default function EditorCard({
  index,
  aiDraft,
  studentText,
  onChange,
  label,
}: EditorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="grid grid-cols-2 gap-4"
    >
      {/* AI Draft (left) */}
      <div className="bg-muted-light rounded-xl p-5 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">{index + 1}</span>
          </div>
          <h4 className="text-sm font-bold text-primary">AI {label}</h4>
        </div>
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
          {aiDraft}
        </p>
      </div>

      {/* Student writing (right) */}
      <div className="bg-white rounded-xl p-5 border-2 border-primary/20 focus-within:border-primary transition-colors">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center">
            <span className="text-xs font-bold text-accent">{index + 1}</span>
          </div>
          <h4 className="text-sm font-bold text-accent">내가 쓰는 {label}</h4>
        </div>
        <textarea
          value={studentText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="AI 초안을 참고해서 나만의 이야기를 써 보세요..."
          className="w-full h-32 text-sm leading-relaxed text-foreground bg-transparent resize-none focus:outline-none placeholder:text-muted/50"
        />
      </div>
    </motion.div>
  );
}
