import type { UserRole } from '@/types/database';

export interface AvatarOption {
  key: string;
  emoji: string;
}

export interface AutoNicknameSource {
  id: string;
  role: UserRole;
  email?: string | null;
  nickname?: string | null;
  student_code?: string | null;
}

export const avatarOptions: AvatarOption[] = [
  { key: 'lion', emoji: '\u{1F981}' },
  { key: 'rabbit', emoji: '\u{1F430}' },
  { key: 'fox', emoji: '\u{1F98A}' },
  { key: 'bear', emoji: '\u{1F43B}' },
  { key: 'panda', emoji: '\u{1F43C}' },
  { key: 'koala', emoji: '\u{1F428}' },
  { key: 'tiger', emoji: '\u{1F42F}' },
  { key: 'frog', emoji: '\u{1F438}' },
  { key: 'unicorn', emoji: '\u{1F984}' },
  { key: 'dog', emoji: '\u{1F436}' },
];

const avatarEmojiByKey = Object.fromEntries(
  avatarOptions.map((option) => [option.key, option.emoji])
) as Record<string, string>;

export function hasNickname(nickname?: string | null): nickname is string {
  return typeof nickname === 'string' && nickname.trim().length > 0;
}

function sanitizeNameFragment(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .split('@')[0]
    ?.replace(/[^0-9A-Za-z\u3131-\uD79D]/g, '')
    .slice(0, 10);

  return normalized || null;
}

export function buildAutoNickname(source: AutoNicknameSource): string {
  if (hasNickname(source.nickname)) {
    return source.nickname.trim();
  }

  if (source.role === 'student') {
    const suffix = source.student_code?.slice(-4) || source.id.slice(0, 4).toUpperCase();
    return `학생 ${suffix}`;
  }

  const prefix = source.role === 'admin' ? '관리자' : '교사';
  const fragment = sanitizeNameFragment(source.email);

  if (!fragment) {
    return `${prefix} ${source.id.slice(0, 4).toUpperCase()}`;
  }

  return `${prefix} ${fragment}`.slice(0, 20);
}

export function getAvatarEmoji(avatarKey?: string | null): string | null {
  if (!avatarKey) {
    return null;
  }

  return avatarEmojiByKey[avatarKey] ?? null;
}

export function getRoleLabel(role: UserRole): string {
  switch (role) {
    case 'student':
      return '학생';
    case 'teacher':
      return '교사';
    case 'admin':
      return '관리자';
  }
}
