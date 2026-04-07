'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import EditorCard from './EditorCard';

interface DraftEditorProps {
  aiDraft: string[];
  hiddenStorySummary?: string;
  onComplete: (finalText: string[]) => void;
}

export default function DraftEditor({
  aiDraft,
  hiddenStorySummary,
  onComplete,
}: DraftEditorProps) {
  const [studentTexts, setStudentTexts] = useState<string[]>(
    aiDraft.map(() => '')
  );
  const [showReference, setShowReference] = useState(false);

  const handleTextChange = (index: number, text: string) => {
    const updated = [...studentTexts];
    updated[index] = text;
    setStudentTexts(updated);
  };

  const allFilled = studentTexts.every((t) => t.trim().length > 0);

  const sectionLabels = ['도입', '전개', '결말'];

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-foreground">이야기 쓰기</h2>
          <p className="text-sm text-muted mt-1">
            왼쪽의 AI 초안을 참고하여 오른쪽에 나만의 이야기를 써 보세요
          </p>
        </div>
        {hiddenStorySummary && (
          <button
            onClick={() => setShowReference(!showReference)}
            className="px-4 py-2 rounded-xl border border-border text-sm font-medium text-muted hover:text-foreground hover:border-primary/40 transition-all"
          >
            {showReference ? '참고 자료 닫기' : '참고 자료 보기'}
          </button>
        )}
      </div>

      {/* Reference panel */}
      <AnimatePresence>
        {showReference && hiddenStorySummary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 p-4 bg-secondary/5 border border-secondary/20 rounded-xl"
          >
            <h3 className="text-sm font-bold text-secondary-dark mb-2">
              숨은 이야기 참고 자료
            </h3>
            <p className="text-sm text-foreground leading-relaxed">
              {hiddenStorySummary}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor cards */}
      <div className="space-y-6">
        {aiDraft.map((draft, index) => (
          <EditorCard
            key={index}
            index={index}
            aiDraft={draft}
            studentText={studentTexts[index]}
            onChange={(text) => handleTextChange(index, text)}
            label={sectionLabels[index] || `구역 ${index + 1}`}
          />
        ))}
      </div>

      {/* Complete button */}
      <div className="mt-8 flex justify-center">
        <motion.button
          whileHover={{ scale: allFilled ? 1.02 : 1 }}
          whileTap={{ scale: allFilled ? 0.98 : 1 }}
          onClick={() => onComplete(studentTexts)}
          disabled={!allFilled}
          className={`
            px-8 py-3 rounded-xl text-base font-bold transition-all
            ${
              allFilled
                ? 'bg-primary text-white hover:bg-primary-dark shadow-lg shadow-primary/20'
                : 'bg-muted-light text-muted cursor-not-allowed'
            }
          `}
        >
          {allFilled ? '완성하기' : '모든 구역을 채워주세요'}
        </motion.button>
      </div>
    </div>
  );
}
