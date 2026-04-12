import type { IllustrationStyle } from '@/types/database';

export interface StorybookFont {
  key: string;
  label: string;
  fileName: string;
  fontFamily: string;
  /** Illustration styles this font pairs well with */
  matchStyles: IllustrationStyle[];
}

export const STORYBOOK_FONTS: StorybookFont[] = [
  {
    key: 'cute-bold',
    label: '귀여운 글씨',
    fileName: '온글잎 강동희_두꺼운 귀여운서체.ttf',
    fontFamily: 'OnGleaf-CuteBold',
    matchStyles: ['cartoon_comic', 'three_d_chibi', 'three_d_clay', 'anime'],
  },
  {
    key: 'picturebook',
    label: '그림책 글씨',
    fileName: '온글잎 뉴보현_두꺼운 어린이그림책용 폰트.ttf',
    fontFamily: 'OnGleaf-PictureBook',
    matchStyles: ['watercolor', 'pastel', 'collage'],
  },
  {
    key: 'thin-neat',
    label: '바른 글씨 (얇은)',
    fileName: '온글잎 섶마루_얇은 바른 글씨.ttf',
    fontFamily: 'OnGleaf-ThinNeat',
    matchStyles: ['rough_drawing', 'woodblock'],
  },
  {
    key: 'diary',
    label: '일기장 글씨',
    fileName: '온글잎 부흥상호체_일상 및 일기.ttf',
    fontFamily: 'OnGleaf-Diary',
    matchStyles: ['stop_motion', 'caricature'],
  },
  {
    key: 'cute-emoji',
    label: '귀여운 이모지 글씨',
    fileName: '온글잎 박다현체_귀여운 스타일_이모지.ttf',
    fontFamily: 'OnGleaf-CuteEmoji',
    matchStyles: ['three_d_animation'],
  },
  {
    key: 'bold-neat',
    label: '바른 글씨 (두꺼운)',
    fileName: '온글잎 의연체_두꺼운 바른글씨.ttf',
    fontFamily: 'OnGleaf-BoldNeat',
    matchStyles: [],
  },
];

/** Pick the best font for a given illustration style, fallback to picturebook font */
export function getRecommendedFont(style: IllustrationStyle | null | undefined): StorybookFont {
  if (style) {
    const match = STORYBOOK_FONTS.find((f) => f.matchStyles.includes(style));
    if (match) return match;
  }
  // Default: picture book font
  return STORYBOOK_FONTS.find((f) => f.key === 'picturebook')!;
}

/** Get font by key */
export function getStorybookFont(key: string): StorybookFont | undefined {
  return STORYBOOK_FONTS.find((f) => f.key === key);
}

/** Generate @font-face CSS for all storybook fonts */
export function generateFontFaceCSS(): string {
  return STORYBOOK_FONTS.map(
    (f) =>
      `@font-face { font-family: '${f.fontFamily}'; src: url('/fonts/${encodeURIComponent(f.fileName)}') format('truetype'); font-display: swap; }`,
  ).join('\n');
}

/** Generate @font-face CSS for a single font */
export function generateSingleFontFaceCSS(font: StorybookFont): string {
  return `@font-face { font-family: '${font.fontFamily}'; src: url('/fonts/${encodeURIComponent(font.fileName)}') format('truetype'); font-display: swap; }`;
}
