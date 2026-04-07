'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

interface Emotion {
  key: string;
  emoji: string;
  label: string;
}

const emotions: Emotion[] = [
  { key: 'joy', emoji: '\u{1F60A}', label: '\uAE30\uC068' },
  { key: 'sadness', emoji: '\u{1F622}', label: '\uC2AC\uD514' },
  { key: 'courage', emoji: '\u{1F4AA}', label: '\uC6A9\uAE30' },
  { key: 'surprise', emoji: '\u{1F632}', label: '\uB180\uB78C' },
  { key: 'anger', emoji: '\u{1F620}', label: '\uD654\uB0A8' },
];

interface EmotionPickerProps {
  onSubmit: (emotion: string, oneLine: string) => void;
  isSubmitting: boolean;
}

export default function EmotionPicker({ onSubmit, isSubmitting }: EmotionPickerProps) {
  const [selectedEmotion, setSelectedEmotion] = useState<string | null>(null);
  const [oneLine, setOneLine] = useState('');
  const [dragOverZone, setDragOverZone] = useState(false);

  const handleSubmit = () => {
    if (selectedEmotion && oneLine.trim()) {
      onSubmit(selectedEmotion, oneLine.trim());
    }
  };

  const handleDragStart = useCallback((e: React.DragEvent<HTMLButtonElement>, emotionKey: string) => {
    e.dataTransfer.setData('text/plain', emotionKey);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverZone(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverZone(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const emotionKey = e.dataTransfer.getData('text/plain');
    if (emotionKey && emotions.find((em) => em.key === emotionKey)) {
      setSelectedEmotion(emotionKey);
    }
    setDragOverZone(false);
  }, []);

  const selectedEmotionData = emotions.find((em) => em.key === selectedEmotion);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-lg mx-auto"
    >
      <h3 className="text-xl font-bold text-foreground text-center mb-2">
        이 책을 읽고 어떤 감정이 들었나요?
      </h3>
      <p className="text-sm text-muted text-center mb-6">
        감정 스티커를 아래 영역에 끌어다 놓거나 클릭하세요
      </p>

      {/* Emotion stickers - draggable */}
      <div className="flex justify-center gap-4 mb-6">
        {emotions.map((em) => (
          <motion.button
            key={em.key}
            draggable
            onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent<HTMLButtonElement>, em.key)}
            onClick={() => setSelectedEmotion(em.key)}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            className={`
              flex flex-col items-center gap-1 p-3 rounded-xl
              transition-all duration-200 cursor-grab active:cursor-grabbing
              ${selectedEmotion === em.key
                ? 'bg-primary/10 ring-2 ring-primary shadow-md scale-110'
                : 'bg-card hover:bg-card-hover'
              }
            `}
          >
            <span className="text-3xl sm:text-4xl select-none">{em.emoji}</span>
            <span className="text-xs font-medium text-foreground">
              {em.label}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          mb-8 p-6 rounded-xl border-2 border-dashed text-center
          transition-all duration-200 min-h-[80px] flex items-center justify-center
          ${dragOverZone
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : selectedEmotionData
              ? 'border-primary/40 bg-primary/5'
              : 'border-muted/40 bg-card'
          }
        `}
      >
        {selectedEmotionData ? (
          <div className="flex items-center gap-3">
            <span className="text-4xl">{selectedEmotionData.emoji}</span>
            <span className="text-lg font-bold text-foreground">
              {selectedEmotionData.label}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted">
            여기에 감정을 끌어다 놓으세요
          </p>
        )}
      </div>

      {/* One-line review */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-foreground mb-2">
          한 줄 감상
        </label>
        <input
          type="text"
          value={oneLine}
          onChange={(e) => setOneLine(e.target.value)}
          placeholder="이 책에서 가장 인상 깊었던 것은..."
          maxLength={200}
          className="w-full px-4 py-3 rounded-xl border border-border
                     bg-card text-foreground placeholder-muted
                     focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent
                     transition-all"
        />
        <p className="text-xs text-muted mt-1 text-right">
          {oneLine.length}/200
        </p>
      </div>

      {/* Submit button */}
      <motion.button
        onClick={handleSubmit}
        disabled={!selectedEmotion || !oneLine.trim() || isSubmitting}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-4 rounded-xl font-bold text-white
                   bg-primary hover:bg-primary-dark
                   disabled:opacity-40 disabled:cursor-not-allowed
                   transition-all text-base shadow-md"
      >
        {isSubmitting ? '저장 중...' : '저장하기'}
      </motion.button>
    </motion.div>
  );
}
