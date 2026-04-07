'use client';

import { motion } from 'framer-motion';

export interface CharacterData {
  id: string;
  name: string;
  role: string;
  age?: string;
  personality?: string;
  speech_style?: string;
  background?: string;
  core_emotion?: string;
  key_moments?: string;
  profile_prompt?: string;
}

interface CharacterCardProps {
  character: CharacterData;
  onSelect: (character: CharacterData) => void;
}

const roleEmojis: Record<string, string> = {
  protagonist: '🌟',
  antagonist: '🎭',
  helper: '🤝',
  mentor: '🧙',
  friend: '👫',
  animal: '🐾',
  default: '👤',
};

function getRoleEmoji(role: string): string {
  const lower = role.toLowerCase();
  for (const [key, emoji] of Object.entries(roleEmojis)) {
    if (lower.includes(key)) return emoji;
  }
  return roleEmojis.default;
}

export default function CharacterCard({ character, onSelect }: CharacterCardProps) {
  return (
    <motion.button
      onClick={() => onSelect(character)}
      className="flex-shrink-0 w-48 bg-card border border-border rounded-2xl p-5 text-left hover:border-primary hover:shadow-lg transition-all duration-200 cursor-pointer group"
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.97 }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{getRoleEmoji(character.role)}</span>
        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
          {character.role}
        </span>
      </div>

      <h3 className="text-base font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
        {character.name}
      </h3>

      <p className="text-xs text-muted leading-relaxed line-clamp-3">
        {character.profile_prompt || character.personality || '이 캐릭터와 대화해 보세요!'}
      </p>

      <div className="mt-3 pt-3 border-t border-border">
        <span className="text-xs text-primary font-medium group-hover:underline">
          대화 시작하기 &rarr;
        </span>
      </div>
    </motion.button>
  );
}
