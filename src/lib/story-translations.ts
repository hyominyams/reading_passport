import type { Language, StoryTranslatedPdfMap, StoryTranslationMap } from '@/types/database';

export interface StoryTranslationLanguageOption {
  code: string;
  label: string;
  englishLabel: string;
}

export const STORY_TRANSLATION_LANGUAGE_OPTIONS: StoryTranslationLanguageOption[] = [
  { code: 'en', label: '영어', englishLabel: 'English' },
  { code: 'vi', label: '베트남어', englishLabel: 'Vietnamese' },
  { code: 'th', label: '태국어', englishLabel: 'Thai' },
  { code: 'ja', label: '일본어', englishLabel: 'Japanese' },
  { code: 'zh', label: '중국어', englishLabel: 'Chinese' },
];

const STORY_TRANSLATION_LANGUAGE_MAP = Object.fromEntries(
  STORY_TRANSLATION_LANGUAGE_OPTIONS.map((option) => [option.code, option])
) as Record<string, StoryTranslationLanguageOption>;

export function getTranslationLanguageLabel(code: string) {
  return STORY_TRANSLATION_LANGUAGE_MAP[code]?.label ?? code.toUpperCase();
}

export function getTranslationLanguageEnglishLabel(code: string) {
  return STORY_TRANSLATION_LANGUAGE_MAP[code]?.englishLabel ?? code;
}

export function inferLegacyTranslationLanguage(sourceLanguage: Language | string | null | undefined) {
  return sourceLanguage === 'ko' ? 'en' : 'ko';
}

export function normalizeTranslatedTextsMap(
  translatedTexts: StoryTranslationMap | null | undefined,
  legacyTranslationText?: string[] | null,
  sourceLanguage?: Language | string | null
): StoryTranslationMap {
  const normalized: StoryTranslationMap = translatedTexts ? { ...translatedTexts } : {};

  if (legacyTranslationText && legacyTranslationText.length > 0) {
    const inferredLanguage = inferLegacyTranslationLanguage(sourceLanguage);
    if (!normalized[inferredLanguage]) {
      normalized[inferredLanguage] = legacyTranslationText;
    }
  }

  return normalized;
}

export function normalizeTranslatedPdfUrlMap(
  translatedPdfUrls: StoryTranslatedPdfMap | null | undefined,
  legacyTranslatedPdfUrl?: string | null,
  sourceLanguage?: Language | string | null
): StoryTranslatedPdfMap {
  const normalized: StoryTranslatedPdfMap = translatedPdfUrls ? { ...translatedPdfUrls } : {};

  if (legacyTranslatedPdfUrl) {
    const inferredLanguage = inferLegacyTranslationLanguage(sourceLanguage);
    if (!normalized[inferredLanguage]) {
      normalized[inferredLanguage] = legacyTranslatedPdfUrl;
    }
  }

  return normalized;
}
