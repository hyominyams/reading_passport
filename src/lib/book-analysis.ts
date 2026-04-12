import type { BookCharacterAnalysis, BookCharacterProfile } from '@/types/database';

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
    : [];
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseCharacters(value: unknown): BookCharacterProfile[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((character): character is Record<string, unknown> => !!character && typeof character === 'object')
    .map((character) => ({
      name: typeof character.name === 'string' && character.name.trim() ? character.name.trim() : 'Unknown',
      role: toOptionalString(character.role),
      age: toOptionalString(character.age),
      personality: toStringArray(character.personality),
      speech_style: toOptionalString(character.speech_style),
      background: toOptionalString(character.background),
      core_emotion: toOptionalString(character.core_emotion),
      key_moments: toOptionalString(character.key_moments),
      profile_prompt: toOptionalString(character.profile_prompt),
    }));
}

export function parseBookCharacterAnalysis(raw: unknown): BookCharacterAnalysis {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const settingSource =
    source.setting && typeof source.setting === 'object' ? source.setting as Record<string, unknown> : {};
  const plotStructureSource =
    source.plot_structure && typeof source.plot_structure === 'object'
      ? source.plot_structure as Record<string, unknown>
      : {};

  return {
    story_summary: typeof source.story_summary === 'string' ? source.story_summary.trim() : '',
    detailed_story_summary:
      typeof source.detailed_story_summary === 'string' ? source.detailed_story_summary.trim() : '',
    setting: {
      time: toOptionalString(settingSource.time),
      place: toOptionalString(settingSource.place),
      social_context: toOptionalString(settingSource.social_context),
      atmosphere: toOptionalString(settingSource.atmosphere),
    },
    plot_structure: {
      beginning: toOptionalString(plotStructureSource.beginning),
      middle: toOptionalString(plotStructureSource.middle),
      climax: toOptionalString(plotStructureSource.climax),
      ending: toOptionalString(plotStructureSource.ending),
    },
    characters: parseCharacters(source.characters),
    key_events: toStringArray(source.key_events),
    plot_points: toStringArray(source.plot_points),
    themes: toStringArray(source.themes),
    important_objects: toStringArray(source.important_objects),
    emotional_keywords: toStringArray(source.emotional_keywords),
    out_of_scope_topics: toStringArray(source.out_of_scope_topics),
  };
}

function formatCharacterLine(character: BookCharacterProfile): string {
  const pieces = [
    character.name,
    character.role ? `역할: ${character.role}` : '',
    character.age ? `나이: ${character.age}` : '',
    character.personality?.length ? `성격: ${character.personality.join(', ')}` : '',
    character.background ? `배경: ${character.background}` : '',
    character.core_emotion ? `핵심 감정: ${character.core_emotion}` : '',
    character.key_moments ? `주요 장면: ${character.key_moments}` : '',
  ].filter(Boolean);

  return pieces.join(' / ');
}

export function buildBookAnalysisPromptContext(analysis: BookCharacterAnalysis): string {
  const lines: string[] = [];

  if (analysis.story_summary) {
    lines.push(`[책 전체 요약] ${analysis.story_summary}`);
  }

  if (analysis.detailed_story_summary) {
    lines.push(`[상세 줄거리] ${analysis.detailed_story_summary}`);
  }

  const settingPieces = [
    analysis.setting.time ? `시간: ${analysis.setting.time}` : '',
    analysis.setting.place ? `장소: ${analysis.setting.place}` : '',
    analysis.setting.social_context ? `배경 맥락: ${analysis.setting.social_context}` : '',
    analysis.setting.atmosphere ? `분위기: ${analysis.setting.atmosphere}` : '',
  ].filter(Boolean);

  if (settingPieces.length > 0) {
    lines.push(`[배경] ${settingPieces.join(' / ')}`);
  }

  if (analysis.characters.length > 0) {
    lines.push(`[등장인물]\n${analysis.characters.map(formatCharacterLine).join('\n')}`);
  }

  if (analysis.plot_points.length > 0) {
    lines.push(`[사건 흐름] ${analysis.plot_points.join(' -> ')}`);
  } else if (analysis.key_events.length > 0) {
    lines.push(`[주요 사건] ${analysis.key_events.join(' -> ')}`);
  }

  const plotStructurePieces = [
    analysis.plot_structure.beginning ? `처음: ${analysis.plot_structure.beginning}` : '',
    analysis.plot_structure.middle ? `중간: ${analysis.plot_structure.middle}` : '',
    analysis.plot_structure.climax ? `절정: ${analysis.plot_structure.climax}` : '',
    analysis.plot_structure.ending ? `끝: ${analysis.plot_structure.ending}` : '',
  ].filter(Boolean);

  if (plotStructurePieces.length > 0) {
    lines.push(`[구조] ${plotStructurePieces.join(' / ')}`);
  }

  if (analysis.themes.length > 0) {
    lines.push(`[주제] ${analysis.themes.join(', ')}`);
  }

  if (analysis.important_objects.length > 0) {
    lines.push(`[중요 소재] ${analysis.important_objects.join(', ')}`);
  }

  if (analysis.emotional_keywords.length > 0) {
    lines.push(`[감정 키워드] ${analysis.emotional_keywords.join(', ')}`);
  }

  return lines.join('\n');
}
