'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { StoryType } from '@/types/database';

interface StoryTypeOption {
  type: StoryType;
  label: string;
  description: string;
  emoji: string;
}

const storyTypes: StoryTypeOption[] = [
  {
    type: 'continue',
    label: '이야기 이어쓰기',
    description: '원래 이야기 뒤에 이어지는 새로운 이야기를 써요',
    emoji: '📖',
  },
  {
    type: 'new_protagonist',
    label: '주인공으로 새 이야기 써보기',
    description: '내가 주인공이 되어 새로운 모험을 떠나요',
    emoji: '🌟',
  },
  {
    type: 'extra_backstory',
    label: '엑스트라 주인공의 뒷이야기 쓰기',
    description: '이야기 속 조연의 숨겨진 이야기를 상상해요',
    emoji: '🎭',
  },
  {
    type: 'change_ending',
    label: '결말 바꾸기',
    description: '이야기의 결말을 내 마음대로 바꿔봐요',
    emoji: '🔄',
  },
  {
    type: 'custom',
    label: '기타: 직접 입력',
    description: '나만의 방법으로 이야기를 만들어요',
    emoji: '✏️',
  },
];

interface StoryTypeSelectorProps {
  onSelect: (type: StoryType, customInput?: string) => void;
}

export default function StoryTypeSelector({ onSelect }: StoryTypeSelectorProps) {
  const [selected, setSelected] = useState<StoryType | null>(null);
  const [customInput, setCustomInput] = useState('');

  const handleSelect = (type: StoryType) => {
    setSelected(type);
    if (type !== 'custom') {
      onSelect(type);
    }
  };

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      onSelect('custom', customInput.trim());
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          어떤 이야기를 만들고 싶어?
        </h2>
        <p className="text-muted">
          만들고 싶은 이야기 유형을 선택해 주세요
        </p>
      </div>

      <div className="grid gap-4">
        {storyTypes.map((option, index) => (
          <motion.button
            key={option.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            onClick={() => handleSelect(option.type)}
            className={`
              w-full text-left p-5 rounded-xl border-2 transition-all
              ${
                selected === option.type
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border bg-card hover:border-primary/40 hover:shadow-sm'
              }
            `}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{option.emoji}</span>
              <div className="flex-1">
                <h3 className="font-bold text-foreground text-lg">
                  {option.label}
                </h3>
                <p className="text-sm text-muted mt-1">
                  {option.description}
                </p>
              </div>
              {selected === option.type && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {selected === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCustomSubmit()}
              placeholder="어떤 이야기를 만들고 싶은지 적어주세요..."
              className="flex-1 px-4 py-3 rounded-xl border-2 border-border bg-white focus:border-primary focus:outline-none text-foreground"
              autoFocus
            />
            <button
              onClick={handleCustomSubmit}
              disabled={!customInput.trim()}
              className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              확인
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
